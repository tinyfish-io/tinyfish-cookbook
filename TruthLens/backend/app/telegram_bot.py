"""Telegram bot for TruthLens.

Two ways to receive messages (set TELEGRAM_MODE):

  polling  (default) the server asks Telegram for new messages. Works on your
           laptop with no public URL and no tunnel.
  webhook  Telegram calls POST /api/telegram/webhook. Needs a public HTTPS
           URL, so use it once the backend is deployed.

In private chats, send any text and the bot fact-checks it. In groups, use
/check <claim>, or reply to a message with /check.
"""

import asyncio
import html
import logging
import os
import re
import time
import unicodedata
from collections import OrderedDict, defaultdict, deque
from uuid import uuid4

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.pipeline.orchestrator import orchestrate_claim

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telegram", tags=["telegram"])

# --------------------------------------------------
# Configuration (environment variables)
# --------------------------------------------------

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
MODE = os.getenv("TELEGRAM_MODE", "polling").strip().lower()
WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
RATE_LIMIT_PER_HOUR = int(os.getenv("TELEGRAM_RATE_LIMIT_PER_HOUR", "20"))
MAX_CONCURRENT_CHECKS = int(os.getenv("TELEGRAM_MAX_CONCURRENT_CHECKS", "3"))
# Optional: comma-separated Telegram user IDs allowed to use the bot.
ALLOWED_USER_IDS = {
    int(n) for n in os.getenv("TELEGRAM_ALLOWED_USER_IDS", "").split(",") if n.strip().isdigit()
}

MAX_CLAIM_CHARS = 2000
MAX_EXPLANATION_CHARS = 1500

_seen_update_ids: OrderedDict[int, None] = OrderedDict()
_recent_requests: dict[int, deque] = defaultdict(deque)
_background_tasks: set[asyncio.Task] = set()
_check_slots = asyncio.Semaphore(MAX_CONCURRENT_CHECKS)
_bot_username: str | None = None


class TelegramError(Exception):
    def __init__(self, code: int, description: str):
        super().__init__(f"{code}: {description}")
        self.code = code
        self.description = description


class _RedactToken(logging.Filter):
    """Tidy httpx's request logs for Telegram calls.

    - httpx logs full request URLs, and Telegram puts the bot token in them,
      so the token is masked.
    - Long polling makes a getUpdates request every ~30 seconds even when
      nobody is messaging the bot; successful ones are dropped as noise.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        message = str(record.getMessage())

        if TOKEN:
            message = message.replace(TOKEN, "<bot-token>")
            record.msg = message
            record.args = ()

        if "api.telegram.org" in message and "/getUpdates" in message and " 200 " in message:
            return False
        return True


logging.getLogger("httpx").addFilter(_RedactToken())

# --------------------------------------------------
# Texts
# --------------------------------------------------

VERDICT_TEXT = {
    "SUPPORTED": ("✅", "Supported", "समर्थित"),
    "REFUTED": ("❌", "Refuted", "खंडित"),
    "MISLEADING": ("⚠️", "Misleading", "भ्रामक"),
    "INSUFFICIENT_EVIDENCE": ("❓", "Insufficient evidence", "अपर्याप्त प्रमाण"),
    "UNVERIFIED_NO_AUTHORITATIVE_SOURCES": ("❓", "Unverified", "असत्यापित"),
}

GREETINGS = {
    "hi", "hii", "hiii", "hello", "hey", "hlo", "help", "start", "menu",
    "hi there", "hello there", "namaste", "namaskar", "नमस्ते", "हैलो", "हेलो",
}

CHECKING_TEXT = "🔍 Checking this claim… / दावे की जांच हो रही है…"
HELP_TEXT = (
    "👋 I'm <b>TruthLens</b>. Send me a news headline, forwarded message or claim "
    "and I'll fact-check it against web sources.\n\n"
    "In groups, use <code>/check your claim</code> or reply to a message with /check.\n\n"
    "कोई खबर, फॉरवर्ड किया हुआ संदेश या दावा भेजें, मैं उसकी जांच करूंगा। "
    "ग्रुप में <code>/check दावा</code> लिखें।"
)
ERROR_TEXT = (
    "Sorry, I couldn't check this claim right now. Please try again.\n\n"
    "क्षमा करें, अभी जांच नहीं हो पाई। कृपया दोबारा कोशिश करें।"
)
RATE_LIMIT_TEXT = (
    "You have reached the hourly limit. Please try again later.\n\n"
    "आपकी प्रति घंटे की सीमा पूरी हो गई है। कृपया बाद में कोशिश करें।"
)
TOO_LONG_TEXT = (
    f"That message is too long. Please send up to {MAX_CLAIM_CHARS} characters.\n\n"
    f"संदेश बहुत लंबा है। कृपया {MAX_CLAIM_CHARS} अक्षरों तक भेजें।"
)

# --------------------------------------------------
# Telegram Bot API
# --------------------------------------------------

async def tg_call(method: str, payload: dict | None = None, timeout: float = 15) -> object:
    """Call a Bot API method and return its `result`."""
    if not TOKEN:
        raise TelegramError(0, "TELEGRAM_BOT_TOKEN is not set")

    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload or {})

    try:
        data = response.json()
    except ValueError:
        raise TelegramError(response.status_code, response.text[:200])

    if not data.get("ok"):
        raise TelegramError(data.get("error_code", response.status_code), data.get("description", ""))
    return data["result"]


async def send_message(chat_id: int, text: str, reply_to: int | None = None) -> int | None:
    payload = {
        "chat_id": chat_id,
        "text": text[:4096],
        "parse_mode": "HTML",
        "link_preview_options": {"is_disabled": True},
    }
    if reply_to:
        payload["reply_parameters"] = {"message_id": reply_to, "allow_sending_without_reply": True}
    try:
        result = await tg_call("sendMessage", payload)
        return result.get("message_id")
    except TelegramError as exc:
        logger.error("Telegram sendMessage failed | chat=%s | %s", chat_id, exc)
        return None


async def edit_message(chat_id: int, message_id: int, text: str) -> bool:
    try:
        await tg_call(
            "editMessageText",
            {
                "chat_id": chat_id,
                "message_id": message_id,
                "text": text[:4096],
                "parse_mode": "HTML",
                "link_preview_options": {"is_disabled": True},
            },
        )
        return True
    except TelegramError as exc:
        logger.warning("Telegram editMessageText failed | chat=%s | %s", chat_id, exc)
        return False


async def get_bot_username() -> str | None:
    global _bot_username
    if _bot_username is None:
        try:
            me = await tg_call("getMe")
            _bot_username = (me.get("username") or "").lower()
        except TelegramError as exc:
            logger.error("Telegram getMe failed: %s", exc)
    return _bot_username

# --------------------------------------------------
# Message parsing
# --------------------------------------------------

def _is_greeting(text: str) -> bool:
    """True for "Hi", "hello!", "Hi 👋" and messages with no letters at all."""
    cleaned = "".join(ch for ch in text.lower() if unicodedata.category(ch)[0] not in ("P", "S"))
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned in GREETINGS or not any(ch.isalpha() for ch in cleaned)


def _text_of(message: dict | None) -> str:
    if not message:
        return ""
    return (message.get("text") or message.get("caption") or "").strip()


async def parse_message(message: dict) -> tuple[str, str]:
    """Return ("help" | "claim" | "ignore", claim_text)."""
    text = _text_of(message)
    private = (message.get("chat") or {}).get("type") == "private"

    if text.startswith("/"):
        command, _, rest = text.partition(" ")
        name, _, target = command[1:].partition("@")
        name = name.lower()

        # In groups several bots may share a command; obey only ours.
        if target and target.lower() != await get_bot_username():
            return "ignore", ""

        if name in ("start", "help"):
            return "help", ""
        if name == "check":
            claim = rest.strip() or _text_of(message.get("reply_to_message"))
            return ("claim", claim) if claim else ("help", "")
        return "ignore", ""

    if not private:
        return "ignore", ""  # in groups only /check is handled

    if not text or _is_greeting(text):
        return "help", ""
    return "claim", text

# --------------------------------------------------
# Reply formatting
# --------------------------------------------------

def _clip(text: str, limit: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _sources_line(result: dict, label: str) -> str:
    seen, links = set(), []
    for item in result.get("evidence") or []:
        url = item.get("source_url") or ""
        domain = item.get("domain") or url
        if not url.startswith(("http://", "https://")) or domain in seen:
            continue
        seen.add(domain)
        links.append(f'<a href="{html.escape(url, quote=True)}">{html.escape(domain)}</a>')
        if len(links) == 3:
            break
    return f"{label} " + " · ".join(links) if links else ""


def format_reply(result: dict) -> str:
    """Verdict message (Telegram HTML) in the claim's own language."""
    verdict = result.get("final_verdict") or result.get("verdict") or ""
    emoji, label_en, label_hi = VERDICT_TEXT.get(
        verdict, ("❓", verdict.replace("_", " ").title(), verdict)
    )
    language = result.get("detected_language", "en")
    explanation = result.get("explanation") or {}

    if language == "hi":
        label, text = label_hi, explanation.get("hi") or explanation.get("en")
        sources_label, footer = "स्रोत:", "स्वचालित जांच, अंतिम निर्णय नहीं।"
    elif language == "hinglish":
        label, text = label_en, explanation.get("original") or explanation.get("en")
        sources_label, footer = "Sources:", "Automated check, not a final ruling. / स्वचालित जांच, अंतिम निर्णय नहीं।"
    else:
        label, text = label_en, explanation.get("en")
        sources_label, footer = "Sources:", "Automated check, not a final ruling."

    parts = [f"{emoji} <b>{html.escape(label)}</b>"]
    if text:
        parts.append(html.escape(_clip(text, MAX_EXPLANATION_CHARS)))
    sources = _sources_line(result, sources_label)
    if sources:
        parts.append(sources)
    parts.append(f"<i>{html.escape(footer)}</i>")
    return "\n\n".join(parts)

# --------------------------------------------------
# Handling an update
# --------------------------------------------------

def _is_new_update(update_id: int | None) -> bool:
    if update_id is None:
        return True
    if update_id in _seen_update_ids:
        return False
    _seen_update_ids[update_id] = None
    while len(_seen_update_ids) > 5000:
        _seen_update_ids.popitem(last=False)
    return True


def _rate_limited(user_id: int) -> bool:
    now = time.monotonic()
    window = _recent_requests[user_id]
    while window and now - window[0] > 3600:
        window.popleft()
    if len(window) >= RATE_LIMIT_PER_HOUR:
        return True
    window.append(now)
    return False


async def handle_update(update: dict) -> None:
    message = update.get("message")
    if not message or not _is_new_update(update.get("update_id")):
        return

    chat_id = (message.get("chat") or {}).get("id")
    user_id = (message.get("from") or {}).get("id")
    message_id = message.get("message_id")
    if chat_id is None or user_id is None or (message.get("from") or {}).get("is_bot"):
        return
    if ALLOWED_USER_IDS and user_id not in ALLOWED_USER_IDS:
        return

    kind, claim = await parse_message(message)
    if kind == "ignore":
        return
    if kind == "help":
        await send_message(chat_id, HELP_TEXT, reply_to=message_id)
        return
    if len(claim) > MAX_CLAIM_CHARS:
        await send_message(chat_id, TOO_LONG_TEXT, reply_to=message_id)
        return
    if _rate_limited(user_id):
        await send_message(chat_id, RATE_LIMIT_TEXT, reply_to=message_id)
        return

    placeholder_id = await send_message(chat_id, CHECKING_TEXT, reply_to=message_id)
    analysis_id = str(uuid4())

    try:
        async with _check_slots:
            result = await asyncio.wait_for(orchestrate_claim(claim=claim), timeout=120)

        # Reuse the API's post-processing (stores the report in the community feed).
        from app.main import _finalize_result

        result = await _finalize_result(result, analysis_id)
        reply = format_reply(result)
    except Exception:
        logger.exception("Telegram analysis failed | id=%s", analysis_id)
        reply = ERROR_TEXT

    # Turn the "Checking…" message into the answer; fall back to a new message.
    if not (placeholder_id and await edit_message(chat_id, placeholder_id, reply)):
        await send_message(chat_id, reply, reply_to=message_id)


async def _safe_handle(update: dict) -> None:
    try:
        await handle_update(update)
    except Exception:
        logger.exception("Telegram update handling failed")


def _spawn(update: dict) -> None:
    task = asyncio.create_task(_safe_handle(update))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

# --------------------------------------------------
# Long polling
# --------------------------------------------------

async def poll_updates() -> None:
    global _bot_username

    # Identify the bot. Retry on network errors (e.g. offline at startup);
    # stop only if Telegram rejects the token.
    delay = 1
    while True:
        try:
            me = await tg_call("getMe")
            break
        except asyncio.CancelledError:
            raise
        except TelegramError as exc:
            if exc.code in (401, 404, 0):
                logger.error("Telegram bot not started: %s (check TELEGRAM_BOT_TOKEN)", exc)
                return
            logger.warning("Telegram getMe failed: %s", exc)
        except Exception as exc:
            logger.warning("Telegram unreachable (%s); retrying in %ss", type(exc).__name__, delay)
        await asyncio.sleep(delay)
        delay = min(delay * 2, 30)

    _bot_username = (me.get("username") or "").lower()
    logger.info("Telegram bot @%s started (polling)", _bot_username)

    # getUpdates does not work while a webhook is registered.
    try:
        await tg_call("deleteWebhook")
    except TelegramError as exc:
        logger.warning("Telegram deleteWebhook failed: %s", exc)

    offset = None
    delay = 1
    while True:
        payload = {"timeout": 30, "allowed_updates": ["message"]}
        if offset is not None:
            payload["offset"] = offset
        try:
            updates = await tg_call("getUpdates", payload, timeout=45)
            delay = 1
            for update in updates:
                offset = update["update_id"] + 1
                _spawn(update)
        except asyncio.CancelledError:
            raise
        except TelegramError as exc:
            if exc.code == 401:
                logger.error("Telegram token rejected; stopping the bot.")
                return
            logger.warning("Telegram polling error: %s", exc)
            # 409 = another process is polling with the same token.
            await asyncio.sleep(5 if exc.code == 409 else delay)
            delay = min(delay * 2, 30)
        except Exception as exc:
            logger.warning("Telegram polling error: %s: %s", type(exc).__name__, exc)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)


def start_polling() -> asyncio.Task | None:
    """Start the polling task if a token is set and polling mode is on."""
    if not TOKEN:
        return None
    if MODE != "polling":
        logger.info("Telegram bot configured for webhook mode")
        return None
    return asyncio.create_task(poll_updates())


async def stop_polling(task: asyncio.Task | None) -> None:
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("Telegram polling task ended with an error")

# --------------------------------------------------
# Webhook mode
# --------------------------------------------------

@router.post("/webhook")
async def receive_webhook(request: Request, background: BackgroundTasks):
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="TELEGRAM_WEBHOOK_SECRET is not set.")

    supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not supplied or supplied != WEBHOOK_SECRET:
        logger.warning("Telegram webhook rejected: bad or missing secret token")
        raise HTTPException(status_code=403, detail="Invalid secret token.")

    try:
        update = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON.")

    background.add_task(_safe_handle, update)
    return {"ok": True}
