"""Parse and normalize LLM / API responses into structured JSON."""

import json
import re
from typing import Any

FABRICATED_METRIC_KEYS = frozenset(
    {
        "confidence_score",
        "projected_mainstream_days",
        "timeline",
        "growth_rate",
        "adoption_score",
        "suitability_score",
    }
)


def parse_llm_json(text: str) -> Any:
    """Extract JSON from raw LLM text, including ```json fenced blocks."""
    if not isinstance(text, str):
        return text

    cleaned = text.strip()
    fence_match = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", cleaned, re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw_text": text}


def normalize_payload(value: Any) -> Any:
    """Recursively unwrap JSON strings embedded in API payloads."""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("{") or stripped.startswith("[") or stripped.startswith("```"):
            parsed = parse_llm_json(stripped)
            if parsed != {"raw_text": value}:
                return normalize_payload(parsed)
        return value
    if isinstance(value, list):
        return [normalize_payload(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize_payload(item) for key, item in value.items()}
    return value


def strip_fabricated_metrics(value: Any) -> Any:
    """Remove invented scores/timelines from LLM payloads."""
    if isinstance(value, list):
        return [strip_fabricated_metrics(item) for item in value]
    if isinstance(value, dict):
        return {
            key: strip_fabricated_metrics(item)
            for key, item in value.items()
            if key not in FABRICATED_METRIC_KEYS
        }
    return value
