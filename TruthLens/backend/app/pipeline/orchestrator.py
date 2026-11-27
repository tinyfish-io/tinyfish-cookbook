
import asyncio
import time
from typing import Any

from app.pipeline.evidence_pipeline import collect_evidence
from app.pipeline.judge import judge_claim
from app.pipeline.progress import ProgressCallback, emit
from app.pipeline.verifier import verify_judgment


async def orchestrate_claim(
    claim: str,
    max_sources: int = 5,
    on_progress: ProgressCallback | None = None,
) -> dict[str, Any]:
    """
    Run the complete TruthLens verification workflow.

    The claim's language is detected automatically. The report is always
    produced in English and Hindi (plus Hinglish when the claim is Hinglish).

    Pipeline:
    1. Detect language, collect and rank evidence.
    2. Ask Gemini to judge the claim.
    3. Verify the judgment deterministically.
    4. Return the complete report and stage timings.
    """
    if not isinstance(claim, str) or not claim.strip():
        raise ValueError("Claim must be a non-empty string.")

    if len(claim) > 2000:
        raise ValueError("Claim must not exceed 2000 characters.")

    if not isinstance(max_sources, int) or isinstance(max_sources, bool):
        raise ValueError("max_sources must be an integer.")

    if not 1 <= max_sources <= 10:
        raise ValueError("max_sources must be between 1 and 10.")

    timings_ms: dict[str, float] = {}
    started_at = time.perf_counter()

    # Stage 1: Research, fetch, chunk, and rank evidence.
    stage_started = time.perf_counter()

    evidence_result = await collect_evidence(
        claim=claim.strip(),
        max_sources=max_sources,
        on_progress=on_progress,
    )

    timings_ms["evidence_collection"] = round(
        (time.perf_counter() - stage_started) * 1000, 2
    )

    normalized_claim = evidence_result.get("claim", claim.strip())
    evidence_chunks = evidence_result.get("evidence_chunks", [])
    detected_language = evidence_result.get("detected_language", "en")
    claim_en = evidence_result.get("claim_en") or normalized_claim

    # Stage 2: Gemini judgment.
    await emit(on_progress, "judging")
    stage_started = time.perf_counter()

    judge_output = await asyncio.to_thread(
        judge_claim,
        claim=normalized_claim,
        evidence_chunks=evidence_chunks,
        detected_language=detected_language,
        claim_en=claim_en,
    )

    timings_ms["judge"] = round(
        (time.perf_counter() - stage_started) * 1000, 2
    )

    # Stage 3: Deterministic verification.
    await emit(on_progress, "verifying")
    stage_started = time.perf_counter()

    verified_result = verify_judgment(
        judge_output=judge_output,
        evidence_chunks=evidence_chunks,
        original_claim=normalized_claim,
    )

    timings_ms["verification"] = round(
        (time.perf_counter() - stage_started) * 1000, 2
    )

    timings_ms["total"] = round(
        (time.perf_counter() - started_at) * 1000, 2
    )

    return {
        "claim": normalized_claim,
        "claim_en": claim_en,
        "detected_language": detected_language,
        "language": detected_language,  # kept for older clients/reports
        "verdict": verified_result.get("final_verdict"),
        "judge_verdict": judge_output.get("verdict"),
        "explanation": judge_output.get("explanation"),
        "diff_segments": judge_output.get("diff_segments", []),
        "claim_vs_reality": judge_output.get("claim_vs_reality"),
        "zombie_suspected": judge_output.get("zombie_suspected", False),
        "escalation": judge_output.get("escalation"),
        "consensus_score": verified_result.get("consensus_score"),
        "dominant_stance": verified_result.get("dominant_stance"),
        "segments_valid": verified_result.get("segments_valid"),
        "evidence": verified_result.get("evidence", []),
        "rejected_evidence": verified_result.get("rejected_evidence", []),
        "search_queries": evidence_result.get("search_queries", []),
        "search_summary": evidence_result.get("search_summary"),
        "sources": evidence_result.get("sources", []),
        "fetch_summary": evidence_result.get("fetch_summary"),
        "evidence_chunks": evidence_chunks,
        "timings_ms": timings_ms,
    }
