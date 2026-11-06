
import re
import unicodedata
from typing import Any


def _normalize_for_comparison(text: str) -> str:
    """Normalize text for quote and claim-segment comparisons."""

    text = unicodedata.normalize("NFC", text or "").casefold()
    # Keep letters and digits from English, Hindi, and other scripts.
    return "".join(char for char in text if char.isalnum())


def _quote_matches(quote: str, source_text: str) -> bool:
    """Check whether a quote appears in a source, ignoring spacing/punctuation."""

    normalized_quote = _normalize_for_comparison(quote)
    normalized_source = _normalize_for_comparison(source_text)

    return bool(normalized_quote) and normalized_quote in normalized_source


def _get_tier(chunk: dict[str, Any]) -> int:
    try:
        tier = int(chunk.get("tier", 4))
        return tier if tier in (1, 2, 3, 4) else 4
    except (TypeError, ValueError):
        return 4


def verify_judgment(
    judge_output: dict[str, Any],
    evidence_chunks: list[dict[str, Any]],
    original_claim: str,
) -> dict[str, Any]:
    """
    Verify Gemini's evidence references, quotations, and claim segmentation.

    The returned consensus score measures the dominant verified stance,
    not the probability that a claim is true.
    """

    if not isinstance(judge_output, dict):
        raise TypeError("judge_output must be a dictionary.")

    if not isinstance(evidence_chunks, list):
        raise TypeError("evidence_chunks must be a list.")

    if not isinstance(original_claim, str) or not original_claim.strip():
        raise ValueError("original_claim must be a non-empty string.")

    chunks_by_id = {}

    for chunk in evidence_chunks:
        if not isinstance(chunk, dict):
            continue

        chunk_id = chunk.get("chunk_id")

        if isinstance(chunk_id, int) and not isinstance(chunk_id, bool):
            chunks_by_id[chunk_id] = chunk

    result = dict(judge_output)
    verified_evidence = []
    rejected_evidence = []

    support_weight = 0.0
    contradict_weight = 0.0
    has_authoritative_evidence = False

    # Verify every evidence reference and quotation.
    for item in judge_output.get("evidence", []):
        if not isinstance(item, dict):
            rejected_evidence.append({
                "item": item,
                "reason": "Invalid evidence item.",
            })
            continue

        chunk_id = item.get("chunk_id")
        chunk = chunks_by_id.get(chunk_id)

        if chunk is None:
            rejected_evidence.append({
                "item": item,
                "reason": "Unknown chunk ID.",
            })
            continue

        quote = item.get("verbatim_quote", "")
        source_text = chunk.get("text", "")

        if not isinstance(quote, str) or not isinstance(source_text, str):
            quote_verified = False
        else:
            quote_verified = _quote_matches(quote, source_text)

        tier = _get_tier(chunk)

        try:
            weight = float(
                chunk.get("tier_weight", {
                    1: 1.0,
                    2: 0.8,
                    3: 0.5,
                    4: 0.2,
                }[tier])
            )
        except (TypeError, ValueError):
            weight = {1: 1.0, 2: 0.8, 3: 0.5, 4: 0.2}[tier]

        weight = max(0.0, min(weight, 1.0))

        verified_item = {
            **item,
            "source_url": chunk.get("source_url", ""),
            "domain": chunk.get("domain", ""),
            "source_language": chunk.get("language"),
            "tier": tier,
            "tier_weight": weight,
            "quote_verified": quote_verified,
        }

        verified_evidence.append(verified_item)

        if not quote_verified:
            verified_item["verification_note"] = "Quote not verified."
            continue

        if tier in (1, 2, 3):
            has_authoritative_evidence = True

        stance = item.get("stance")

        if stance == "SUPPORTS":
            support_weight += weight
        elif stance == "CONTRADICTS":
            contradict_weight += weight
        # CONTEXT is retained but excluded from the consensus formula.

    # Check that diff segments reconstruct the original claim.
    segments = judge_output.get("diff_segments", [])

    segments_valid = (
        isinstance(segments, list)
        and all(
            isinstance(segment, dict)
            and isinstance(segment.get("text"), str)
            for segment in segments
        )
        and "".join(segment["text"] for segment in segments)
        == original_claim.strip()
    )

    # Only quote-verified supporting and contradicting evidence counts.
    total_weight = support_weight + contradict_weight

    if total_weight == 0:
        consensus_score = 0.0
        dominant_stance = "NONE"
        final_verdict = "INSUFFICIENT_EVIDENCE"
    else:
        consensus_score = round(
            max(support_weight, contradict_weight) / total_weight * 100,
            2,
        )

        if support_weight > contradict_weight:
            dominant_stance = "SUPPORTS"
        elif contradict_weight > support_weight:
            dominant_stance = "CONTRADICTS"
        else:
            dominant_stance = "TIED"

        if dominant_stance == "TIED":
            final_verdict = "INSUFFICIENT_EVIDENCE"
        elif consensus_score < 60:
            final_verdict = "INSUFFICIENT_EVIDENCE"
        elif dominant_stance == "SUPPORTS":
            final_verdict = "SUPPORTED"
        else:
            final_verdict = "REFUTED"

    # Hard override: no authoritative corroboration means an unverified cap.
    all_evidence_is_tier4 = (
        bool(verified_evidence)
        and all(item["tier"] == 4 for item in verified_evidence)
    )

    if all_evidence_is_tier4 and not has_authoritative_evidence:
        consensus_score = min(consensus_score, 35.0)
        final_verdict = "UNVERIFIED_NO_AUTHORITATIVE_SOURCES"

    # Broken diff segments must not be presented as a valid pinpoint diff.
    if not segments_valid:
        result["diff_segments"] = [
            {
                "text": original_claim.strip(),
                "label": "MISLEADING",
                "correction": None,
                "evidence_chunk_ids": [],
            }
        ]

    result["evidence"] = verified_evidence
    result["rejected_evidence"] = rejected_evidence
    result["segments_valid"] = segments_valid
    result["consensus_score"] = consensus_score
    result["dominant_stance"] = dominant_stance
    result["final_verdict"] = final_verdict

    return result
