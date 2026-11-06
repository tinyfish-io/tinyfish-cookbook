"""Manage the Telegram webhook (only needed for TELEGRAM_MODE=webhook).

    python tools/telegram_webhook.py set https://your-host.example.com
    python tools/telegram_webhook.py info
    python tools/telegram_webhook.py delete

Run it from the backend folder. It reads TELEGRAM_BOT_TOKEN and
TELEGRAM_WEBHOOK_SECRET from backend/.env. Polling mode does not need this.
"""

import json
import sys
import urllib.request
from pathlib import Path


def read_env(name: str) -> str:
    env_file = Path(__file__).resolve().parent.parent / ".env"
    for line in env_file.read_text(encoding="utf-8").splitlines():
        key, _, value = line.partition("=")
        if key.strip() == name:
            return value.strip().strip('"').strip("'")
    return ""


def call(token: str, method: str, payload: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload or {}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read())


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in ("set", "info", "delete"):
        sys.exit(__doc__)

    token = read_env("TELEGRAM_BOT_TOKEN")
    if not token:
        sys.exit("TELEGRAM_BOT_TOKEN is missing from backend/.env")

    action = sys.argv[1]
    if action == "set":
        if len(sys.argv) < 3 or not sys.argv[2].startswith("https://"):
            sys.exit("Give the public HTTPS base URL, e.g. https://your-host.example.com")
        secret = read_env("TELEGRAM_WEBHOOK_SECRET")
        if not secret:
            sys.exit("TELEGRAM_WEBHOOK_SECRET is missing from backend/.env")
        url = sys.argv[2].rstrip("/") + "/api/telegram/webhook"
        result = call(token, "setWebhook", {
            "url": url,
            "secret_token": secret,
            "allowed_updates": ["message"],
        })
    elif action == "delete":
        result = call(token, "deleteWebhook")
    else:
        result = call(token, "getWebhookInfo")

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
