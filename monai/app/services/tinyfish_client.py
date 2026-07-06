import os

import httpx
from dotenv import load_dotenv

load_dotenv()

TINYFISH_API_KEY = os.getenv("TINYFISH_API_KEY")
TINYFISH_SEARCH_URL = os.getenv("TINYFISH_SEARCH_URL", "https://api.search.tinyfish.ai").rstrip("/")
TINYFISH_FETCH_URL = os.getenv("TINYFISH_FETCH_URL", "https://api.fetch.tinyfish.ai").rstrip("/")

DEFAULT_LOCATION = os.getenv("TINYFISH_SEARCH_LOCATION", "VN")
DEFAULT_LANGUAGE = os.getenv("TINYFISH_SEARCH_LANGUAGE", "vi")


def _headers() -> dict[str, str]:
    if not TINYFISH_API_KEY:
        raise ValueError("TINYFISH_API_KEY environment variable not set")
    return {"X-API-Key": TINYFISH_API_KEY}


async def search_tinyfish(
    query: str,
    max_results: int = 10,
    *,
    location: str | None = None,
    language: str | None = None,
    purpose: str | None = None,
) -> dict:
    """Search the web via TinyFish Search API (GET https://api.search.tinyfish.ai)."""
    params: dict[str, str] = {
        "query": query,
        "location": location or DEFAULT_LOCATION,
        "language": language or DEFAULT_LANGUAGE,
    }
    if purpose:
        params["purpose"] = purpose[:2000]

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(TINYFISH_SEARCH_URL, params=params, headers=_headers())
        response.raise_for_status()
        data = response.json()

    results = data.get("results", [])
    if max_results and len(results) > max_results:
        data = {**data, "results": results[:max_results]}
    return data


async def fetch_tinyfish(url: str, *, format: str = "markdown") -> dict:
    """Fetch page content via TinyFish Fetch API (POST https://api.fetch.tinyfish.ai)."""
    payload = {"urls": [url], "format": format}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            TINYFISH_FETCH_URL,
            json=payload,
            headers={**_headers(), "Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()
