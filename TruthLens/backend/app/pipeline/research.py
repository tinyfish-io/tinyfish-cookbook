import asyncio
from typing import Any

from app.pipeline.language import search_language_code
from app.pipeline.planner import generate_queries
from app.pipeline.progress import ProgressCallback, emit
from app.pipeline.search import search_many


async def research_claim(
    claim: str,
    on_progress: ProgressCallback | None = None,
) -> dict[str, Any]:
    """
    Detect the claim's language, generate search queries for it, and search
    for relevant sources.
    """

    # Stage 1: Ask Gemini to detect the language, translate the claim, and
    # generate focused search queries.
    # The Gemini SDK call is blocking, so run it in a worker thread to keep
    # the event loop (and progress streaming) responsive.
    await emit(on_progress, "planning")
    plan = await asyncio.to_thread(generate_queries, claim)
    detected_language = plan["detected_language"]
    await emit(
        on_progress,
        "planned",
        queries=plan["search_queries"],
        language=detected_language,
    )

    # Stage 2: Search those queries using TinyFish. Each query carries its own
    # language code; Hindi-speaking users also get India-scoped results.
    location = "India" if detected_language in ("hi", "hinglish") else None
    query_params = {
        query: {
            "language": search_language_code(language),
            "location": location,
        }
        for query, language in plan["query_languages"].items()
    }

    search_results = await search_many(
        plan["search_queries"],
        max_queries=5,
        query_params=query_params,
        on_progress=on_progress,
    )

    return {
        "claim": plan["claim"],
        "claim_en": plan["claim_en"],
        "detected_language": detected_language,
        "search_queries": plan["search_queries"],
        "search_results": search_results,
    }
