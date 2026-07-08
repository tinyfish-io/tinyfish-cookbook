from typing import Any, Dict, List
from urllib.parse import urlparse

from api.models.schemas import QueryType

LOW_SIGNAL_DOMAINS = {
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "fb.com",
    "tiktok.com",
    "instagram.com",
    "reddit.com",
    "twitter.com",
    "x.com",
    "voz.vn",
    "studocu.vn",
}

APP_GATED_DOMAINS = {
    "grab.com",
    "food.grab.com",
    "shopeefood.vn",
    "shopee.vn",
    "be.com.vn",
}

HIGH_VALUE_HINTS = {
    QueryType.REAL_ESTATE: ("batdongsan", "chotot", "dotproperty", "propertyguru"),
    QueryType.SME_LOAN: (
        "vietcombank",
        "techcombank",
        "bidv",
        "vpbank",
        "mbbank",
        "acb.com",
    ),
    QueryType.REGULATORY: ("sbv.gov", "mof.gov", "ssc.gov", "chinhphu"),
    QueryType.MOBILITY: ("baogia", "tuoitre", "vnexpress", "cafef", "vietnamnet"),
    QueryType.COMPETITOR: (
        "grabfood",
        "shopeefood",
        "highland",
        "phuclong",
        "vnexpress",
        "cafef",
    ),
}


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower().replace("www.", "")
    except Exception:
        return ""


def _snippet(result: Dict[str, Any]) -> str:
    for key in ("snippet", "description", "content", "text", "summary"):
        value = result.get(key)
        if isinstance(value, str):
            return value.strip()
    return ""


def is_low_signal_host(url: str) -> bool:
    host = _host(url)
    return any(host == domain or host.endswith(f".{domain}") for domain in LOW_SIGNAL_DOMAINS)


def is_app_gated_host(url: str) -> bool:
    host = _host(url)
    return any(host == domain or host.endswith(f".{domain}") for domain in APP_GATED_DOMAINS)


def score_search_result(result: Dict[str, Any], query_type: QueryType) -> float:
    if not isinstance(result, dict):
        return -10.0

    url = result.get("url") or ""
    host = _host(url)
    if not host:
        return -10.0

    score = 0.0
    snippet = _snippet(result)
    title = str(result.get("title") or "")

    if host.endswith(".vn"):
        score += 2.0
    elif query_type in {
        QueryType.REGULATORY,
        QueryType.REAL_ESTATE,
        QueryType.SME_LOAN,
        QueryType.COMPETITOR,
    }:
        score -= 2.0
    if any(token in title.lower() for token in ("giá", "phí", "lãi suất", "thuê", "rent", "fee")):
        score += 1.0
    if snippet:
        score += min(2.0, len(snippet) / 400)

    hints = HIGH_VALUE_HINTS.get(query_type, ())
    if any(hint in host for hint in hints):
        score += 3.0

    if any(host == domain or host.endswith(f".{domain}") for domain in LOW_SIGNAL_DOMAINS):
        score -= 4.0

    if query_type == QueryType.MOBILITY and is_app_gated_host(url):
        score -= 2.5

    if any(token in host for token in ("linkedin.com", "pinterest.com")):
        score -= 1.5

    return score


def rank_search_results(
    results: List[Dict[str, Any]],
    query_type: QueryType,
    limit: int,
) -> List[Dict[str, Any]]:
    deduped: Dict[str, Dict[str, Any]] = {}
    for result in results:
        if not isinstance(result, dict):
            continue
        url = result.get("url")
        if not url:
            continue
        existing = deduped.get(url)
        if existing is None or score_search_result(result, query_type) > score_search_result(
            existing, query_type
        ):
            deduped[url] = result

    ranked = sorted(
        deduped.values(),
        key=lambda item: score_search_result(item, query_type),
        reverse=True,
    )
    return ranked[:limit]


def filter_results_for_fetch(
    results: List[Dict[str, Any]],
    query_type: QueryType,
    limit: int,
) -> List[Dict[str, Any]]:
    """Prefer editorial/news sources; never pad with social when a real source exists."""
    ranked = rank_search_results(results, query_type=query_type, limit=max(limit * 3, limit + 3))

    editorial = [
        item
        for item in ranked
        if not is_low_signal_host(item.get("url") or "")
        and not is_app_gated_host(item.get("url") or "")
    ]
    if editorial:
        return editorial[:limit]

    non_social = [item for item in ranked if not is_low_signal_host(item.get("url") or "")]
    if non_social:
        return non_social[:limit]

    return ranked[:limit]
