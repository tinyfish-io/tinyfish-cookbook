"""Infer the best query type from natural language when users pick the wrong drawer."""

from api.models.schemas import QueryType

_SIGNALS: dict[QueryType, tuple[str, ...]] = {
    QueryType.MOBILITY: (
        "grabfood",
        "shopeefood",
        "grab food",
        "shopee food",
        "delivery fee",
        "delivery fees",
        "giao hàng",
        "phí giao",
        "phí ship",
        "base fare",
        "per km",
        "per-km",
        "xanh sm",
        "be taxi",
        "gojek",
    ),
    QueryType.REAL_ESTATE: (
        "shophouse",
        "rent per",
        "rent/m",
        "m²",
        "m2",
        "batdongsan",
        "commercial rent",
        "thao dien",
        "giá thuê",
        "rent per m",
    ),
    QueryType.SME_LOAN: (
        "loan rate",
        "lending rate",
        "collateral",
        "uncollateralized",
        "sme loan",
        "lãi suất",
        "vay sme",
        "vietcombank",
        "techcombank",
        "agribank",
        "vpbank",
    ),
    QueryType.REGULATORY: (
        "sbv",
        "circular",
        "regulation",
        "foreign ownership",
        "licensing",
        "nhnn",
        "compliance",
        "quy định",
        "zoning",
        "commercial zoning",
        "quy hoạch",
    ),
    QueryType.COMPETITOR: (
        "storefront",
        "bubble tea",
        "combo pricing",
        "market share",
        "brand density",
        "competitor",
        "vs ",
        "gong cha",
        "koi",
        "phuc long",
    ),
}


def classify_query_type(query: str, requested: QueryType) -> QueryType:
    """Only override the user's drawer when signals are strong and unambiguous."""
    lowered = query.lower()
    scores: dict[QueryType, int] = {qt: 0 for qt in QueryType}

    for query_type, signals in _SIGNALS.items():
        for signal in signals:
            if signal in lowered:
                scores[query_type] += 2 if " " in signal else 1

    best_type = max(scores, key=lambda qt: scores[qt])
    best_score = scores[best_type]
    requested_score = scores.get(requested, 0)

    if best_score >= 3 and best_score >= requested_score + 2:
        return best_type
    return requested
