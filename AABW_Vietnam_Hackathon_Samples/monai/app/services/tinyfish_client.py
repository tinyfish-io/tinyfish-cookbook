import os

from dotenv import load_dotenv
from tinyfish import AsyncTinyFish

load_dotenv()

DEFAULT_LOCATION = os.getenv("TINYFISH_SEARCH_LOCATION", "VN")
DEFAULT_LANGUAGE = os.getenv("TINYFISH_SEARCH_LANGUAGE", "vi")

_client: AsyncTinyFish | None = None


def _get_client() -> AsyncTinyFish:
    global _client
    if _client is None:
        if not os.getenv("TINYFISH_API_KEY"):
            raise ValueError("TINYFISH_API_KEY environment variable not set")
        _client = AsyncTinyFish(timeout=60.0)
    return _client


async def search_tinyfish(
    query: str,
    max_results: int = 10,
    *,
    location: str | None = None,
    language: str | None = None,
    purpose: str | None = None,
) -> dict:
    """Search the web via the official TinyFish Python SDK."""
    del purpose  # SDK search accepts query/location/language only
    client = _get_client()
    response = await client.search.query(
        query,
        location=location or DEFAULT_LOCATION,
        language=language or DEFAULT_LANGUAGE,
    )
    data = response.model_dump()
    results = data.get("results", [])
    if max_results and len(results) > max_results:
        data = {**data, "results": results[:max_results]}
    return data


async def fetch_tinyfish(url: str, *, format: str = "markdown") -> dict:
    """Fetch page content via the official TinyFish Python SDK."""
    client = _get_client()
    response = await client.fetch.get_contents([url], format=format)  # type: ignore[arg-type]
    return response.model_dump()
