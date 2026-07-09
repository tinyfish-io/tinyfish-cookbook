import asyncio
import time
from typing import Dict, Any, List, Optional
from api.models.schemas import IntelligenceResult, QueryResponse, QueryType
from api.services.tinyfish_client import tinyfish_client
from api.services.llm_client import llm_client
from api.services.data_quality import (
    assess_data_quality,
    count_verified_signals,
    is_weak_value,
    resolve_response_status,
)
from api.services.pipeline import PipelineEmitter, host_from_url
from api.services.query_planner import plan_recovery_queries, plan_search_queries
from api.services.source_ranker import (
    filter_results_for_fetch,
    is_app_gated_host,
    is_low_signal_host,
    rank_search_results,
    score_search_result,
)
from api.services.query_classifier import classify_query_type
from api.core.logger import logger
from api.core.config import settings

_async_cache: Dict[str, Any] = {}
CACHE_TTL = 3600
CACHE_VERSION = "v14_query_answered"


class AgentWorkflows:
    def __init__(self):
        self.fetch_semaphore = asyncio.Semaphore(settings.max_concurrent_fetches)

    async def _safe_fetch(self, url: str, emitter: PipelineEmitter) -> str:
        host = host_from_url(url)
        await emitter.emit("fetch", f"fetching {host}…", url=url, status="pending")
        async with self.fetch_semaphore:
            try:
                content = await tinyfish_client.fetch(url)
                if content:
                    await emitter.emit(
                        "fetch",
                        f"fetched {host} ({len(content):,} chars)",
                        url=url,
                        status="ok",
                    )
                    return content
                await emitter.emit(
                    "fetch",
                    f"no extractable content from {host}",
                    url=url,
                    status="failed",
                )
                return ""
            except Exception as e:
                logger.error(f"Failed to fetch {url}: {e}")
                await emitter.emit(
                    "fetch",
                    f"fetch failed — {host}",
                    url=url,
                    status="failed",
                )
                return ""

    @staticmethod
    def _snippet_from_search_result(result: Dict[str, Any]) -> str:
        for key in ("snippet", "description", "content", "text", "summary"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    @staticmethod
    def _infer_answer_status(query: str, coverage_gaps: List[str], extracted_facts: Optional[dict]) -> str:
        if extracted_facts:
            raw_status = str(extracted_facts.get("answer_status") or "").strip().lower()
            if raw_status in {"direct", "partial", "indirect", "not_answered"}:
                return raw_status

        gap_text = " ".join(coverage_gaps).lower()
        query_text = query.lower()

        if any(token in query_text for token in ("delivery fee", "delivery fees", "phí giao", "phí ship")):
            if any(token in gap_text for token in ("delivery fee", "delivery fees", "phí giao", "phí ship")):
                return "not_answered"
        if any(token in query_text for token in ("foreign capital", "foreign ownership", "capital injection")):
            if any(token in gap_text for token in ("foreign capital", "foreign ownership", "capital injection")):
                return "indirect"
        if any(token in query_text for token in ("storefront density", "density", "number of stores")):
            if any(token in gap_text for token in ("storefront density", "density", "not covered")):
                return "not_answered"
        if any(token in query_text for token in ("valuation", "collateral valuation", "average rent", "rent per")):
            if any(token in gap_text for token in ("valuation", "average", "rent", "not covered", "not detailed")):
                return "indirect"

        return "direct"

    async def _run_searches(
        self,
        queries: List[str],
        query_type: QueryType,
        emitter: PipelineEmitter,
    ) -> List[Dict[str, Any]]:
        per_query_limit = max(2, settings.search_result_limit)

        async def search_one(search_query: str) -> List[Dict[str, Any]]:
            await emitter.emit("search", f'angle: "{search_query[:90]}"')
            batch = await tinyfish_client.search(query=search_query, limit=per_query_limit)
            return [result for result in batch if isinstance(result, dict) and result.get("url")]

        batches = await asyncio.gather(*(search_one(q) for q in queries))
        combined: List[Dict[str, Any]] = [item for batch in batches for item in batch]

        ranked = rank_search_results(
            combined,
            query_type=query_type,
            limit=settings.search_result_limit + 1,
        )

        for result in ranked:
            url = result.get("url", "")
            title = result.get("title", "Unknown Source")
            score = score_search_result(result, query_type)
            await emitter.emit(
                "search",
                f"ranked {host_from_url(url)} (score {score:.1f}) — {title[:55]}",
                url=url,
                status="ok" if score >= 0 else "warn",
            )

        return ranked

    async def _collect_source_content(
        self,
        search_results: List[Dict[str, Any]],
        emitter: PipelineEmitter,
    ) -> tuple[List[str], List[str]]:
        valid_contents: List[str] = []
        valid_urls: List[str] = []

        editorial = [
            result
            for result in search_results
            if isinstance(result, dict)
            and result.get("url")
            and not is_low_signal_host(result.get("url") or "")
            and not is_app_gated_host(result.get("url") or "")
        ]
        to_process = editorial if editorial else search_results

        if editorial and len(editorial) < len(search_results):
            skipped = len(search_results) - len(editorial)
            await emitter.emit(
                "fetch",
                f"skipped {skipped} social/app-gated source(s) — using editorial only",
                status="warn",
            )

        if settings.use_search_snippets_only:
            await emitter.emit(
                "fetch",
                "snippet-only mode — skipping full page fetch",
                status="warn",
            )
            for result in to_process:
                if not isinstance(result, dict):
                    continue
                url = result.get("url")
                if not url:
                    continue
                title = result.get("title", "Unknown Source")
                snippet = self._snippet_from_search_result(result)
                if not snippet:
                    await emitter.emit(
                        "fetch",
                        f"snippet empty — {host_from_url(url)}",
                        url=url,
                        status="failed",
                    )
                    continue
                valid_contents.append(
                    f"Source: {title} ({url})\nSnippet:\n{snippet[:settings.source_content_limit]}"
                )
                valid_urls.append(url)
                await emitter.emit(
                    "fetch",
                    f"snippet from {host_from_url(url)} ({len(snippet)} chars)",
                    url=url,
                    status="ok",
                )
            return valid_contents, valid_urls

        urls = [result.get("url") for result in to_process if isinstance(result, dict) and result.get("url")]
        titles = [
            result.get("title", "Unknown Source")
            for result in to_process
            if isinstance(result, dict)
        ][: len(urls)]

        fetch_tasks = [self._safe_fetch(url, emitter) for url in urls]
        fetched_contents = await asyncio.gather(*fetch_tasks)

        for i, content in enumerate(fetched_contents):
            if content:
                title = titles[i] if i < len(titles) else "Unknown Source"
                valid_contents.append(
                    f"Source: {title} ({urls[i]})\nContent:\n{content[:settings.source_content_limit]}"
                )
                valid_urls.append(urls[i])

        return valid_contents, valid_urls

    async def process_query(
        self,
        query: str,
        query_type: QueryType,
        emitter: Optional[PipelineEmitter] = None,
    ) -> QueryResponse:
        pipeline = emitter or PipelineEmitter()
        cache_key = f"{CACHE_VERSION}:{query_type.value}:{query}"
        now = time.time()

        if cache_key in _async_cache:
            cache_entry = _async_cache[cache_key]
            if now < cache_entry["expires_at"]:
                logger.info(f"Cache hit for query: {query}")
                cached: QueryResponse = cache_entry["result"]
                for event in cached.pipeline:
                    await pipeline.emit(
                        event.stage,
                        event.message,
                        url=event.url,
                        status=event.status,
                        meta=event.meta,
                    )
                return cached
            del _async_cache[cache_key]

        logger.info(f"Processing new query: '{query}' (Type: {query_type.value})")
        resolved_type = classify_query_type(query, query_type)
        if resolved_type != query_type:
            await pipeline.emit(
                "search",
                f'query classified as {resolved_type.value} (was {query_type.value})',
                status="warn",
            )
            query_type = resolved_type

        await pipeline.emit(
            "search",
            f'planning multi-angle search for: "{query[:80]}"',
        )

        search_queries = plan_search_queries(
            query, query_type, max_angles=settings.max_search_angles
        )
        search_results = await self._run_searches(search_queries, query_type, pipeline)
        search_results = filter_results_for_fetch(
            search_results,
            query_type=query_type,
            limit=settings.search_result_limit + 1,
        )
        sources_discovered = len(search_results)

        if not search_results:
            await pipeline.emit("search", "no sources discovered", status="failed")
            return QueryResponse(
                status="no_results",
                results=[],
                analysis="No relevant information could be found for the given query.",
                query_type=query_type,
                pipeline=pipeline.events,
            )

        valid_contents, valid_urls = await self._collect_source_content(search_results, pipeline)

        recovery_threshold = 2
        if len(valid_urls) < recovery_threshold:
            await pipeline.emit(
                "search",
                "thin pass — running recovery search angles",
                status="warn",
            )
            recovery_results = await self._run_searches(
                plan_recovery_queries(
                    query,
                    query_type,
                    max_angles=2,
                ),
                query_type,
                pipeline,
            )
            merged = rank_search_results(
                search_results + recovery_results,
                query_type=query_type,
                limit=settings.search_result_limit + 2,
            )
            merged = filter_results_for_fetch(
                merged,
                query_type=query_type,
                limit=settings.search_result_limit + 2,
            )
            recovery_contents, recovery_urls = await self._collect_source_content(merged, pipeline)
            if len(recovery_urls) > len(valid_urls):
                valid_contents, valid_urls = recovery_contents, recovery_urls
                search_results = merged
                sources_discovered = len(merged)

        combined_context = "\n\n---\n\n".join(valid_contents)
        sources_with_content = len(valid_urls)
        low_signal_count = sum(
            1
            for url in valid_urls
            if is_low_signal_host(url) or is_app_gated_host(url)
        )

        preflight_status = (
            "ok"
            if sources_with_content >= 2 and low_signal_count < sources_with_content
            else "warn"
            if sources_with_content >= 1
            else "failed"
        )
        await pipeline.emit(
            "preflight",
            (
                f"source layer: {sources_with_content} usable / {sources_discovered} ranked "
                f"({low_signal_count} social/video/app-gated)"
            ),
            status=preflight_status,
            meta={
                "discovered": sources_discovered,
                "usable": sources_with_content,
                "social": low_signal_count,
            },
        )

        if sources_with_content < 2:
            await pipeline.emit(
                "fetch",
                f"⚠ thin source layer — only {sources_with_content} usable source(s)",
                status="warn",
            )

        if not combined_context.strip():
            await pipeline.emit("synthesize", "aborted — no extractable source content", status="failed")
            return QueryResponse(
                status="fetch_failed",
                results=[],
                analysis="Could not extract content from the underlying sources.",
                query_type=query_type,
                pipeline=pipeline.events,
            )

        extracted_facts: Optional[dict] = None
        if not settings.skip_fact_extraction:
            await pipeline.emit(
                "synthesize",
                "extracting structured facts from sources…",
                status="pending",
            )
            extracted_facts = await llm_client.extract_facts(
                context=combined_context, query=query, query_type=query_type
            )
            verified_metric_count = len(extracted_facts.get("verified_metrics") or [])
            coverage_gaps = [
                str(gap)
                for gap in (extracted_facts.get("coverage_gaps") or [])
                if isinstance(gap, str) and gap.strip()
            ]
            gap_count = len(coverage_gaps)
            await pipeline.emit(
                "synthesize",
                f"extracted {verified_metric_count} verified metric(s), {gap_count} coverage gap(s)",
                status="ok" if verified_metric_count else "warn",
            )

        await pipeline.emit(
            "synthesize",
            f"composing desk memo from {sources_with_content} source(s)…",
            status="pending",
        )
        report = await llm_client.synthesize(
            context=combined_context,
            query=query,
            query_type=query_type,
            extracted_facts=extracted_facts,
        )

        verified_metric_count = (
            len(extracted_facts.get("verified_metrics") or [])
            if extracted_facts
            else count_verified_signals(report)
        )
        coverage_gaps = (
            [
                str(gap)
                for gap in (extracted_facts.get("coverage_gaps") or [])
                if isinstance(gap, str) and gap.strip()
            ]
            if extracted_facts
            else [caveat for caveat in report.caveats if "gap" in caveat.lower() or "not contain" in caveat.lower()][:4]
        )
        answer_status = self._infer_answer_status(query, coverage_gaps, extracted_facts)

        quality = assess_data_quality(
            report=report,
            source_urls=valid_urls,
            sources_discovered=sources_discovered,
            sources_with_content=sources_with_content,
            used_snippets_only=settings.use_search_snippets_only,
        )
        quality.verified_metrics_count = verified_metric_count
        quality.coverage_gaps = coverage_gaps[:6]

        all_kpis_placeholder = bool(report.metrics) and all(
            is_weak_value(metric.value) for metric in report.metrics
        )
        mostly_low_signal = (
            sources_with_content > 0
            and low_signal_count >= max(1, (sources_with_content + 1) // 2)
        )
        if all_kpis_placeholder or (verified_metric_count == 0 and mostly_low_signal):
            quality.score = min(quality.score, 0.34)
            quality.tier = "insufficient"
            if "No verified numeric metrics extracted from sources." not in quality.reasons:
                quality.reasons.append("No verified numeric metrics extracted from sources.")
        if answer_status == "indirect":
            quality.score = min(quality.score, 0.59)
            if quality.tier == "high":
                quality.tier = "medium"
            quality.reasons.append(
                "Sources provide adjacent context, but do not directly answer the exact question asked."
            )
        elif answer_status == "not_answered":
            quality.score = min(quality.score, 0.34)
            quality.tier = "insufficient"
            quality.reasons.append(
                "Sources did not directly answer the requested metric / fee / regulation."
            )

        response_status = resolve_response_status(quality.tier)

        if quality.tier == "insufficient":
            await pipeline.emit(
                "synthesize",
                f"insufficient data — confidence {int(quality.score * 100)}% (not board-ready)",
                status="failed",
            )
        elif response_status == "partial":
            await pipeline.emit(
                "synthesize",
                f"partial brief — confidence {int(quality.score * 100)}% (verify sources)",
                status="warn",
            )
        else:
            await pipeline.emit(
                "synthesize",
                f"desk brief ready — confidence {int(quality.score * 100)}%",
                status="ok",
            )

        headline = report.headline or f"Intelligence: {query[:60]}"
        summary = report.executive_summary or headline

        if quality.tier == "insufficient" and (
            all_kpis_placeholder or mostly_low_signal or answer_status == "not_answered"
        ):
            headline = "Insufficient verified data — not board-ready"
            summary = (
                "Could not verify the requested pricing or fee data from available sources. "
                "See coverage gaps and gap analysis below."
                if mostly_low_signal or all_kpis_placeholder or answer_status == "not_answered"
                else report.executive_summary or headline
            )
            report.metrics = [] if all_kpis_placeholder else report.metrics
            report.comparison_table = [] if all_kpis_placeholder else report.comparison_table
            report.recommendation = ""
            report.key_findings = [] if all_kpis_placeholder else report.key_findings
            if not any("insufficient" in c.lower() for c in report.caveats):
                report.caveats = [
                    "Source data was too thin to support board-ready pricing or rate conclusions.",
                    *report.caveats,
                ][:4]
            report.headline = headline

        analysis_sections: List[str] = []
        if report.key_findings:
            findings_block = "\n".join(f"- {finding}" for finding in report.key_findings[:7])
            analysis_sections.append(f"**Supporting findings**\n\n{findings_block}")
        if report.recommendation:
            analysis_sections.append(f"**Committee recommendation**\n\n{report.recommendation}")
        if report.caveats:
            caveats_block = "\n".join(f"- {caveat}" for caveat in report.caveats[:6])
            analysis_sections.append(f"**Evidence notes**\n\n{caveats_block}")
        analysis_text = "\n\n".join(section for section in analysis_sections if section.strip())

        final_response = QueryResponse(
            status=response_status,
            results=[
                IntelligenceResult(
                    title=headline,
                    summary=summary,
                    structured=report,
                    source_urls=valid_urls,
                    confidence_score=quality.score,
                )
            ],
            analysis=analysis_text,
            query_type=query_type,
            data_quality=quality,
            pipeline=pipeline.events,
        )

        if response_status == "success":
            _async_cache[cache_key] = {
                "result": final_response,
                "expires_at": time.time() + CACHE_TTL,
            }

        logger.info(
            f"Workflow complete. status={response_status} confidence={quality.score}"
        )
        return final_response


agent_workflows = AgentWorkflows()
