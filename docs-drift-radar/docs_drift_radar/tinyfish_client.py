"""TinyFish Fetch client.

Fetch is the only endpoint this recipe needs — it turns any URL into clean markdown,
so we never run a headless browser ourselves, and it is **free** (failed URLs included),
which is what makes the live demo cost nothing to run.

The retry policy matches the reference clients already in this cookbook
(`AABW_Vietnam_Hackathon_Samples/finsight/api/services/tinyfish_client.py`): transport
failures, 5xx, and rate limits get exponential backoff; 4xx does not, because a 404
will still be a 404 ten seconds later.

The SDK is imported lazily so the pure-Python modules (normalize/diffing/store) stay
importable and testable without the `tinyfish` wheel installed.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 45.0
DEFAULT_MAX_RETRIES = 2

# Field names we accept for the page body. The SDK returns `text`; the aliases are
# cheap insurance against a rename rather than a guess about today's shape.
_TEXT_FIELDS = ("text", "content", "markdown")


@dataclass(frozen=True)
class FetchResult:
    """Outcome of fetching one URL."""

    url: str
    ok: bool
    text: str = ""
    error: str | None = None

    @property
    def char_count(self) -> int:
        return len(self.text)


def _field(item: object, name: str) -> object:
    """Read `name` from a pydantic model or a plain dict."""

    if isinstance(item, dict):
        return item.get(name)
    return getattr(item, name, None)


def _is_retryable(exc: BaseException) -> bool:
    """Transient TinyFish failures only."""

    try:
        from tinyfish import (
            APIConnectionError,
            APIStatusError,
            APITimeoutError,
            InternalServerError,
            RateLimitError,
        )
    except Exception:  # SDK missing — let the original error surface
        return False

    if isinstance(exc, (APIConnectionError, APITimeoutError, InternalServerError, RateLimitError)):
        return True
    if isinstance(exc, APIStatusError):
        return int(getattr(exc, "status_code", 0) or 0) >= 500
    return False


def _extract_text(response: object, url: str) -> str | None:
    """Body for `url`, falling back to the first result with any content."""

    results = _field(response, "results") or []
    if not isinstance(results, (list, tuple)):
        return None

    def matches(item: object) -> bool:
        candidate = _field(item, "url")
        return isinstance(candidate, str) and candidate.rstrip("/") == url.rstrip("/")

    ordered = [item for item in results if matches(item)] or list(results)
    for item in ordered:
        for field in _TEXT_FIELDS:
            value = _field(item, field)
            if isinstance(value, str) and value.strip():
                return value
    return None


def _extract_error(response: object) -> str | None:
    """First entry of `response.errors`, whatever shape the SDK used."""

    errors = _field(response, "errors") or []
    if not isinstance(errors, (list, tuple)) or not errors:
        return None
    first = errors[0]
    for field in ("error", "message", "reason"):
        value = _field(first, field)
        if isinstance(value, str) and value.strip():
            return value
    return str(first)


class TinyFishFetcher:
    """Fetches one URL at a time.

    One URL per call rather than batching: results are then trivially mapped back to
    their source, and concurrency in the scanner already supplies the parallelism.
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        from tinyfish import AsyncTinyFish

        kwargs: dict[str, object] = {
            "timeout": float(timeout),
            "max_retries": int(max_retries),
        }
        if api_key:
            kwargs["api_key"] = api_key
        self._client = AsyncTinyFish(**kwargs)
        self.api_key_configured = bool(api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_is_retryable),
        reraise=True,
    )
    async def _get_contents(self, url: str) -> object:
        return await self._client.fetch.get_contents(urls=[url], format="markdown")

    async def fetch(self, url: str) -> FetchResult:
        """Fetch `url` as markdown. Never raises — failures come back as data."""

        try:
            response = await self._get_contents(url)
        except Exception as exc:  # noqa: BLE001 — reported per source, not fatal
            logger.warning("fetch failed for %s: %s", url, exc)
            return FetchResult(url=url, ok=False, error=f"{type(exc).__name__}: {exc}")

        text = _extract_text(response, url)
        if text is None:
            return FetchResult(
                url=url,
                ok=False,
                error=_extract_error(response) or "response contained no page content",
            )
        return FetchResult(url=url, ok=True, text=text)
