from typing import List
from api.models.schemas import QueryType


def _unique_keep_order(items: List[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for item in items:
        key = item.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        ordered.append(item.strip())
    return ordered


def plan_search_queries(query: str, query_type: QueryType, max_angles: int = 4) -> List[str]:
    """Generate multiple search angles for harder off-script queries."""
    queries = [query]

    lowered = query.lower()
    if "vietnam" not in lowered and "việt nam" not in lowered and "tp.hcm" not in lowered:
        queries.append(f"{query} Vietnam")

    if query_type == QueryType.MOBILITY or (
        any(token in lowered for token in ("grabfood", "shopeefood", "grab food", "delivery fee", "giao hàng"))
    ):
        if any(token in lowered for token in ("district 7", "quận 7", "quan 7", "d7", "q7")):
            queries.append("phí giao hàng GrabFood ShopeeFood Quận 7 TP.HCM vnexpress cafef")
        else:
            queries.append("phí giao hàng GrabFood ShopeeFood TP.HCM báo chí 2025")
    elif query_type == QueryType.COMPETITOR:
        queries.extend(
            [
                f"{query} menu giá cửa hàng Việt Nam",
                f"{query} storefront density Ho Chi Minh City",
            ]
        )
    elif query_type == QueryType.REAL_ESTATE:
        queries.extend(
            [
                f"{query} batdongsan.com.vn",
                f"{query} giá thuê m2 TP.HCM",
            ]
        )
    elif query_type == QueryType.SME_LOAN:
        queries.extend(
            [
                f"{query} lãi suất vay SME ngân hàng Việt Nam",
                f"{query} interest rate collateral Vietnam bank",
            ]
        )
    elif query_type == QueryType.REGULATORY:
        if any(token in lowered for token in ("zoning", "quy hoạch", "district 2", "quận 2")):
            queries.extend(
                [
                    "quy hoạch quận 2 TP.HCM thương mại 2025 site:vn",
                    f"{query} chinhphu.vn OR sbv.gov.vn",
                ]
            )
        else:
            queries.extend(
                [
                    f"{query} SBV circular Vietnam fintech",
                    f"{query} quy định NHNN",
                ]
            )

    return _unique_keep_order(queries)[:max_angles]


def plan_recovery_queries(query: str, query_type: QueryType, max_angles: int = 1) -> List[str]:
    """Fallback searches when the first pass is thin."""
    lowered = query.lower()

    if query_type == QueryType.MOBILITY or "grab" in lowered or "shopee" in lowered:
        return _unique_keep_order(
            [
                "GrabFood phí giao hàng tối thiểu TP.HCM báo chí",
                "ShopeeFood delivery surcharge Vietnam forum",
                "food delivery app pricing Vietnam comparison article",
            ]
        )[:max_angles]

    if query_type == QueryType.COMPETITOR:
        return _unique_keep_order(
            [
                f"{query} review pricing Vietnam",
                f"{query} brand ranking Vietnam market share",
            ]
        )[:max_angles]

    return _unique_keep_order([f"{query} Vietnam news data report"])[:max_angles]
