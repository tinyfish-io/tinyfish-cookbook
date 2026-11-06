
import asyncio
import inspect
from typing import Any

from tinyfish import TinyFish

from app.config import TINYFISH_API_KEY
from app.pipeline.progress import ProgressCallback, emit


def _to_dict(result: Any) -> Any:
    """Convert SDK response objects into JSON-compatible data."""

    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")

    if isinstance(result, (dict, list, str, int, float, bool)) or result is None:
        return result

    return str(result)


async def search_one(
    query: str,
    language: str | None = None,
    location: str | None = None,
) -> dict[str, Any]:
    """Run one TinyFish search query and return its results.

    `language` (e.g. "hi") and `location` (e.g. "India") are optional hints.
    If TinyFish rejects them, the query is retried once without the hints so a
    bad hint never costs us the search.
    """

    query = query.strip() if isinstance(query, str) else ""

    if not query:
        raise ValueError("Search query cannot be empty.")

    hints = {}
    if language:
        hints["language"] = language
    if location:
        hints["location"] = location

    client = TinyFish(api_key=TINYFISH_API_KEY)

    async def run(**kwargs: Any) -> Any:
        # The SDK call is blocking; run it in a worker thread.
        result = await asyncio.to_thread(
            client.search.query, query=query, **kwargs
        )

        if inspect.isawaitable(result):
            result = await result

        return result

    try:
        used_hints = hints

        try:
            result = await run(**hints)
        except Exception:
            if not hints:
                raise
            used_hints = {}
            result = await run()

        return {
            "query": query,
            "results": _to_dict(result),
            "error": None,
            "hints": used_hints,
        }

    except Exception as exc:
        # Preserve the error so one failed query need not stop all searches.
        return {
            "query": query,
            "results": [],
            "error": f"{type(exc).__name__}: {exc}",
        }

    finally:
        close = getattr(client, "close", None)

        if close:
            result = close()

            if inspect.isawaitable(result):
                await result


async def search_many(
    queries: list[str],
    max_queries: int = 5,
    query_params: dict[str, dict[str, str | None]] | None = None,
    on_progress: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Search several queries and retain each query's outcome.

    `query_params` optionally maps a query string to its search hints
    ({"language": ..., "location": ...}).
    """

    if not isinstance(queries, list):
        raise TypeError("queries must be a list of strings.")

    if not 1 <= max_queries <= 10:
        raise ValueError("max_queries must be between 1 and 10.")

    cleaned_queries = []
    seen = set()

    for query in queries:
        if not isinstance(query, str):
            continue

        query = query.strip()

        if query and query.casefold() not in seen:
            cleaned_queries.append(query)
            seen.add(query.casefold())

    cleaned_queries = cleaned_queries[:max_queries]

    if not cleaned_queries:
        raise ValueError("At least one non-empty search query is required.")

    # Keep requests sequential initially to avoid unnecessary API load.
    outcomes = []
    await emit(on_progress, "searching", total=len(cleaned_queries))

    for index, query in enumerate(cleaned_queries, start=1):
        params = (query_params or {}).get(query, {})
        outcome = await search_one(
            query,
            language=params.get("language"),
            location=params.get("location"),
        )
        outcomes.append(outcome)

        response = outcome["results"] if isinstance(outcome["results"], dict) else {}
        found = response.get("results")
        await emit(
            on_progress,
            "searched",
            index=index,
            total=len(cleaned_queries),
            query=query,
            found=len(found) if isinstance(found, list) else 0,
            ok=outcome["error"] is None,
        )

    successful = sum(item["error"] is None for item in outcomes)

    return {
        "queries_attempted": len(cleaned_queries),
        "queries_succeeded": successful,
        "queries_failed": len(cleaned_queries) - successful,
        "searches": outcomes,
    }
