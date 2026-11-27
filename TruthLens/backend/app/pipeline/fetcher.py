
import asyncio
import inspect
from typing import Any

from tinyfish import TinyFish

from app.config import (
    TINYFISH_API_KEY,
    FETCH_PER_URL_TIMEOUT_MS,
)


def _to_dict(response: Any) -> Any:
    """Convert TinyFish response objects into serializable data."""

    if hasattr(response, "model_dump"):
        return response.model_dump(mode="json")

    if isinstance(response, (dict, list, str, int, float, bool)) or response is None:
        return response

    return str(response)


async def fetch_urls(urls: list[str]) -> dict[str, Any]:
    """
    Fetch webpage contents through TinyFish.

    Returns the provider response so later modules can extract
    page text, metadata, and fetch errors.
    """

    if not isinstance(urls, list):
        raise TypeError("urls must be a list of strings.")

    cleaned_urls = []
    seen = set()

    for url in urls:
        if not isinstance(url, str):
            continue

        url = url.strip()

        if not url:
            continue

        if not url.startswith(("https://", "http://")):
            continue

        if url not in seen:
            cleaned_urls.append(url)
            seen.add(url)

    if not cleaned_urls:
        raise ValueError("Provide at least one valid HTTP(S) URL.")

    client = TinyFish(api_key=TINYFISH_API_KEY)

    try:
        # The SDK call is blocking; run it in a worker thread.
        response = await asyncio.to_thread(
            client.fetch.get_contents,
            urls=cleaned_urls,
            purpose="Retrieve webpage text for claim verification.",
            format="markdown",
            per_url_timeout_ms=FETCH_PER_URL_TIMEOUT_MS,
        )

        if inspect.isawaitable(response):
            response = await response

        return {
            "requested_urls": cleaned_urls,
            "response": _to_dict(response),
            "error": None,
        }

    except Exception as exc:
        return {
            "requested_urls": cleaned_urls,
            "response": None,
            "error": f"{type(exc).__name__}: {exc}",
        }

    finally:
        close = getattr(client, "close", None)

        if close:
            result = close()

            if inspect.isawaitable(result):
                await result
