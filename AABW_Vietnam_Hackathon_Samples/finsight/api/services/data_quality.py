import re
from typing import List, Optional

from api.models.schemas import DataQuality, StructuredReport
from api.services.source_ranker import is_app_gated_host, is_low_signal_host

WEAK_VALUE_RE = re.compile(
    r"^(unknown|variable|n/a|na|tbd|not available|insufficient|unavailable|"
    r"not found|no data|pending|—|-+|\?+)\s*(vnd|%)?$",
    re.IGNORECASE,
)


def is_weak_value(value: Optional[str]) -> bool:
    if value is None:
        return True
    text = str(value).strip()
    if not text:
        return True
    if WEAK_VALUE_RE.match(text):
        return True
    lowered = text.lower()
    if "unknown" in lowered or "variable" in lowered:
        if any(token in lowered for token in ("vnd", "%", "rate", "fee", "price", "rent")):
            return True
    return False


def _host_quality(url: str) -> str:
    if is_low_signal_host(url) or is_app_gated_host(url):
        return "low"
    return "ok"


def count_verified_signals(report: StructuredReport) -> int:
    """Count concrete values in metrics and comparison table."""
    total = 0
    for metric in report.metrics or []:
        if not is_weak_value(metric.value):
            total += 1
    for row in report.comparison_table or []:
        for key, value in row.items():
            if key == "entity":
                continue
            if not is_weak_value(value):
                total += 1
    return total


def assess_data_quality(
    report: StructuredReport,
    source_urls: List[str],
    sources_discovered: int,
    sources_with_content: int,
    used_snippets_only: bool,
) -> DataQuality:
    reasons: List[str] = []

    metrics = report.metrics or []
    weak_metrics = sum(1 for m in metrics if is_weak_value(m.value))
    strong_metrics = len(metrics) - weak_metrics

    table_rows = report.comparison_table or []
    weak_table_cells = 0
    table_cells = 0
    for row in table_rows:
        for key, value in row.items():
            if key == "entity":
                continue
            table_cells += 1
            if is_weak_value(value):
                weak_table_cells += 1

    low_signal_sources = sum(1 for url in source_urls if _host_quality(url) == "low")
    ok_sources = len(source_urls) - low_signal_sources

    score = 0.0

    if sources_discovered > 0:
        score += min(0.15, sources_discovered * 0.05)
    if sources_with_content > 0:
        score += min(0.35, sources_with_content * 0.15)
    if strong_metrics > 0:
        score += min(0.3, strong_metrics * 0.1)
    if table_rows and weak_table_cells < table_cells:
        score += 0.1
    if ok_sources > 0:
        score += min(0.1, ok_sources * 0.05)

    score -= weak_metrics * 0.12
    score -= weak_table_cells * 0.04
    score -= low_signal_sources * 0.08
    if used_snippets_only and not (ok_sources == len(source_urls) and ok_sources > 0):
        score -= 0.08
        reasons.append("Used search snippets only — no full page extraction.")
    if sources_with_content < 2:
        reasons.append(f"Only {sources_with_content} usable source(s) returned content.")
    if weak_metrics and metrics:
        reasons.append(f"{weak_metrics}/{len(metrics)} KPIs are placeholders (Unknown/Variable).")
    if low_signal_sources:
        reasons.append(
            f"{low_signal_sources} source(s) are social/video or app-gated pages — weak for pricing data."
        )
    if weak_table_cells and table_cells:
        reasons.append(
            f"{weak_table_cells}/{table_cells} comparison fields lack concrete values."
        )

    score = max(0.0, min(1.0, round(score, 2)))

    if (
        sources_with_content == 0
        or (metrics and weak_metrics == len(metrics))
    ):
        tier = "insufficient"
    elif score < 0.35 and strong_metrics == 0 and low_signal_sources >= max(1, sources_with_content // 2):
        tier = "insufficient"
    elif score < 0.55:
        tier = "low"
    elif score < 0.75:
        tier = "medium"
    else:
        tier = "high"

    return DataQuality(
        score=score,
        tier=tier,
        sources_discovered=sources_discovered,
        sources_fetched=len(source_urls),
        sources_with_content=sources_with_content,
        weak_metrics_count=weak_metrics,
        low_signal_sources=low_signal_sources,
        reasons=reasons,
    )


def resolve_response_status(tier: str) -> str:
    if tier == "insufficient":
        return "insufficient_data"
    if tier in {"low", "medium"}:
        return "partial"
    return "success"
