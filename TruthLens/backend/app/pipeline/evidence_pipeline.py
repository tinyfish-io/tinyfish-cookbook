
from typing import Any

from app.pipeline.research import research_claim
from app.pipeline.domain_registry import (
    rank_sources,
    normalize_domain,
    normalize_organization,
)
from app.pipeline.fetcher import fetch_urls
from app.pipeline.chunker import chunk_pages, rank_evidence_chunks
from app.pipeline.progress import ProgressCallback, emit


async def collect_evidence(
    claim: str,
    max_sources: int = 5,
    on_progress: ProgressCallback | None = None,
) -> dict[str, Any]:
    """
    Search for sources, rank them, fetch their contents,
    and split retrieved content into evidence chunks.

    Source selection limits the number of URLs per organization,
    including related hostnames such as PIB subdomains.
    """

    if not isinstance(claim, str) or not claim.strip():
        raise ValueError("Claim must be a non-empty string.")

    if not isinstance(max_sources, int) or isinstance(max_sources, bool):
        raise TypeError("max_sources must be an integer.")

    if not 1 <= max_sources <= 10:
        raise ValueError("max_sources must be between 1 and 10.")

    # Stage 1: Generate search queries and search the web.
    research = await research_claim(claim.strip(), on_progress=on_progress)

    # Stage 2: Extract unique URLs and retain their metadata.
    source_metadata = {}
    candidate_urls = []

    for search in research["search_results"]["searches"]:
        if search.get("error"):
            continue

        response = search.get("results") or {}
        results = response.get("results", [])

        if not isinstance(results, list):
            continue

        for item in results:
            if not isinstance(item, dict):
                continue

            url = item.get("url")

            if not isinstance(url, str):
                continue

            url = url.strip()

            if not url.startswith(("https://", "http://")):
                continue

            if url not in source_metadata:
                source_metadata[url] = {
                    "url": url,
                    "title": item.get("title") or "",
                    "snippet": item.get("snippet") or "",
                }
                candidate_urls.append(url)

    # Stage 3: Rank sources using the domain registry.
    ranked_sources = rank_sources(candidate_urls)

    # Stage 4: Select sources with organization-level diversity.
    # At most two URLs per organization are selected.
    max_per_organization = 2
    selected_sources = []
    organization_counts = {}
    deferred_sources = []

    for source in ranked_sources:
        organization = normalize_organization(source["url"])

        if not organization:
            deferred_sources.append(source)
            continue

        count = organization_counts.get(organization, 0)

        if count < max_per_organization:
            selected_sources.append(source)
            organization_counts[organization] = count + 1
        else:
            deferred_sources.append(source)

        if len(selected_sources) >= max_sources:
            break

    # Fill remaining slots from deferred candidates only when
    # their organization still has room under the same limit.
    if len(selected_sources) < max_sources:
        for source in deferred_sources:
            if len(selected_sources) >= max_sources:
                break

            organization = normalize_organization(source["url"])

            if not organization:
                continue

            count = organization_counts.get(organization, 0)

            if count < max_per_organization:
                selected_sources.append(source)
                organization_counts[organization] = count + 1

    # Stage 5: Attach search-result metadata to selected sources.
    sources = []

    for ranked in selected_sources:
        metadata = source_metadata.get(ranked["url"], {})
        sources.append({
            **metadata,
            **ranked,
        })

    # Tell the caller which sources were chosen before they are fetched.
    await emit(
        on_progress,
        "sources",
        sources=[
            {
                "url": source["url"],
                "title": source.get("title") or "",
                "domain": (source.get("domain") or "").removeprefix("www."),
                "tier": source.get("tier"),
            }
            for source in sources
        ],
    )

    # Stage 6: Fetch the selected webpages.
    fetch_result = None
    evidence_chunks = []

    if sources:
        await emit(on_progress, "fetching", total=len(sources))
        fetch_result = await fetch_urls(
            [source["url"] for source in sources]
        )

        # Stage 7: Split retrieved pages into evidence chunks.
        if fetch_result.get("response"):
            evidence_chunks = chunk_pages(fetch_result)

            # Stage 8: Rank chunks by relevance and source quality.
            evidence_chunks = rank_evidence_chunks(
                chunks=evidence_chunks,
                claim=research["claim"],
                claim_en=research.get("claim_en"),
                sources=sources,
                top_k=12,
                max_chunks_per_domain=3,
            )

    # Stage 9: Summarize fetch results.
    response_data = (
        fetch_result.get("response", {})
        if fetch_result
        else {}
    )

    response_errors = (
        response_data.get("errors", [])
        if isinstance(response_data, dict)
        else []
    )

    fetched_pages = (
        response_data.get("results", [])
        if isinstance(response_data, dict)
        else []
    )

    if sources:
        await emit(
            on_progress,
            "fetched",
            fetched=len(fetched_pages),
            requested=len(sources),
        )

    # Stage 10: Return the collected evidence.
    return {
        "claim": research["claim"],
        "claim_en": research.get("claim_en") or research["claim"],
        "detected_language": research.get("detected_language", "en"),
        "search_queries": research["search_queries"],
        "search_summary": {
            "attempted": research["search_results"]["queries_attempted"],
            "succeeded": research["search_results"]["queries_succeeded"],
            "failed": research["search_results"]["queries_failed"],
        },
        "sources": sources,
        "fetch_summary": {
            "requested": len(sources),
            "fetched": len(fetched_pages),
            "errors": response_errors,
            "error": (
                fetch_result.get("error")
                if fetch_result
                else None
            ),
        },
        "evidence_chunks": evidence_chunks,
    }
