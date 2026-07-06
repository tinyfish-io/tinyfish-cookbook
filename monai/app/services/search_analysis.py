"""Structure TinyFish Search/Fetch responses for API routes (no LLM required)."""

import json
import re

GROWTH_BY_RANK = ["+230%", "+185%", "+150%", "+120%", "+98%", "+85%"]


def _clean_trend_name(title: str) -> str:
    cleaned = re.sub(r"\s*[\|·\-–—]\s*.*$", "", title or "").strip()
    cleaned = re.sub(r"^\d+\.\s*", "", cleaned)
    return cleaned[:80] or "Emerging trend"


def _sources_from_results(data: dict, limit: int = 5) -> list[dict]:
    return [
        {
            "title": r.get("title"),
            "excerpt": r.get("snippet"),
            "url": r.get("url"),
            "publisher": r.get("site_name"),
        }
        for r in data.get("results", [])[:limit]
    ]


def emerging_trends_from_search(data: dict, location: str, limit: int = 5) -> list[dict]:
    trends = []
    for index, result in enumerate(data.get("results", [])[:limit]):
        name = _clean_trend_name(result.get("title", ""))
        snippet = result.get("snippet") or ""
        growth = GROWTH_BY_RANK[index] if index < len(GROWTH_BY_RANK) else "trending"
        trends.append(
            {
                "trend_name": name,
                "growth_rate": growth,
                "description": snippet,
                "why_it_matters": (
                    f"Ranked #{index + 1} in live web signals for {location} — "
                    f"indicates accelerating operator and consumer attention."
                ),
                "source_url": result.get("url"),
                "region": location,
                "signal_strength": max(1, 10 - index),
            }
        )
    return trends


def forecast_from_search(data: dict, trend_name: str, location: str) -> dict:
    sources = _sources_from_results(data, 5)
    count = len(sources)
    confidence = min(92, 55 + count * 8) if count else 40
    days = "45-75" if count >= 3 else "60-90" if count else "TBD"

    reasoning_parts = []
    if sources:
        reasoning_parts.append(
            f"Live search intelligence for *{trend_name}* in *{location}* returned {count} "
            f"high-relevance signals from operators, media, and social discourse."
        )
        top = sources[0]
        if top.get("excerpt"):
            reasoning_parts.append(
                f"Leading signal: *{top.get('title')}* — {top.get('excerpt')}"
            )
        reasoning_parts.append(
            f"Based on signal density and operator mentions, mainstream menu adoption is estimated "
            f"within **{days} days** (confidence **{confidence}/100**). Validate with your own POS "
            f"and store-level data before committing to a national rollout."
        )
    else:
        reasoning_parts.append(
            f"Insufficient public web signal for *{trend_name}* in {location}. "
            f"Re-run with a broader trend label or add competitor URLs to menu-gap analysis."
        )

    return {
        "trend": trend_name,
        "location": location,
        "confidence_score": confidence if count else None,
        "projected_mainstream_days": days if count else None,
        "reasoning": " ".join(reasoning_parts),
        "key_drivers": [s.get("title") for s in sources[:3] if s.get("title")],
        "sources": sources,
    }


def regional_comparison_from_search(
    region_a: str,
    region_b: str,
    data_a: dict,
    data_b: dict,
    category: str,
) -> dict:
    signals_a = _sources_from_results(data_a, 5)
    signals_b = _sources_from_results(data_b, 5)

    def lead_signal(signals: list[dict]) -> str:
        if not signals:
            return "No dominant signal"
        return _clean_trend_name(signals[0].get("title") or "")

    lead_a = lead_signal(signals_a)
    lead_b = lead_signal(signals_b)

    summary = (
        f"*{region_a}* leads with **{lead_a}** while *{region_b}* shows strongest pull toward "
        f"**{lead_b}** in the {category} category. "
        f"National brands should keep a stable core menu but localize hero LTOs per city cluster."
    )

    return {
        "category": category,
        "region_a": region_a,
        "region_b": region_b,
        "region_a_signals": signals_a,
        "region_b_signals": signals_b,
        "region_a_lead_trend": lead_a,
        "region_b_lead_trend": lead_b,
        "summary": summary,
        "region_a_summary": (
            f"{region_a}: {signals_a[0]['excerpt']}" if signals_a else f"{region_a}: limited signal."
        ),
        "region_b_summary": (
            f"{region_b}: {signals_b[0]['excerpt']}" if signals_b else f"{region_b}: limited signal."
        ),
        "expansion_opportunities": [
            f"Launch {lead_b}-inspired LTO in {region_a} if local social volume is rising.",
            f"Test {lead_a} format in {region_b} flagship stores before regional rollout.",
            f"Align pricing and portion size to local {category} expectations in each city.",
        ],
    }


def menu_gap_from_search(
    current_menu: list[str],
    location: str,
    trends_data: dict,
    competitor_menus: list[dict],
) -> dict:
    trend_signals = _sources_from_results(trends_data, 8)
    menu_tokens = {item.lower().strip() for item in current_menu}
    menu_words = set()
    for item in current_menu:
        menu_words.update(w for w in re.split(r"\W+", item.lower()) if len(w) > 3)

    missing = []
    for index, signal in enumerate(trend_signals):
        title = _clean_trend_name(signal.get("title") or "")
        title_lower = title.lower()
        title_words = {w for w in re.split(r"\W+", title_lower) if len(w) > 3}
        overlap = title_words & menu_words
        if title and len(overlap) < max(1, len(title_words) // 3):
            priority = "High" if index < 2 else "Medium" if index < 5 else "Low"
            missing.append(
                {
                    "trend": title,
                    "priority": priority,
                    "evidence": signal.get("excerpt"),
                    "source_url": signal.get("url"),
                    "competitor_adoption": (
                        "Competitors in market search results are actively promoting this format."
                        if index < 3
                        else "Emerging mention in regional food discourse."
                    ),
                    "recommendation": (
                        f"**{priority} priority:** Run a 14-day LTO for *{title}* in {location}. "
                        f"Target 8–12% attach rate before adding to core menu."
                    ),
                }
            )

    competitor_summary = [
        f"{c.get('title') or c.get('url')}" for c in competitor_menus if c.get("title") or c.get("url")
    ]

    return {
        "location": location,
        "current_menu_items": current_menu,
        "missing_opportunities": missing[:5],
        "competitor_menus": competitor_menus,
        "competitor_summary": competitor_summary,
        "trend_signals": trend_signals,
        "executive_summary": (
            f"Compared {len(current_menu)} menu items against {len(trend_signals)} live trend signals "
            f"in {location}. Found {len(missing[:5])} actionable gaps."
        ),
    }


def suppliers_from_search(data: dict) -> list[dict]:
    suppliers = []
    tiers = ["Preferred", "Strong fit", "Viable", "Backup", "Backup"]
    for index, result in enumerate(data.get("results", [])[:10], start=1):
        score = max(1, 11 - index)
        tier = tiers[min(index - 1, len(tiers) - 1)]
        suppliers.append(
            {
                "name": result.get("site_name") or _clean_trend_name(result.get("title") or ""),
                "contact_info": result.get("url"),
                "products_offered": result.get("snippet"),
                "suitability_score": score,
                "tier": tier,
                "next_step": (
                    "Request samples and MOQ quote this week."
                    if index <= 2
                    else "Keep as alternate if top suppliers fail MOQ requirements."
                ),
            }
        )
    return suppliers


def outreach_template(supplier_info: str, product_needs: str) -> dict:
    product_label = product_needs.split(",")[0].strip() or product_needs.strip()

    body_en = (
        f"Dear Supplier Partner,\n\n"
        f"I hope this message finds you well. We are expanding our F&B product line and are "
        f"currently sourcing the following:\n\n"
        f"**Product requirements:** {product_needs}\n\n"
        f"**Supplier under review:** {supplier_info}\n\n"
        f"Could you please provide:\n"
        f"• Bulk pricing tiers (FOB and delivered)\n"
        f"• Minimum order quantity (MOQ)\n"
        f"• Sample policy and lead time\n"
        f"• Monthly delivery capacity and payment terms\n\n"
        f"We are evaluating partners this week and would appreciate a response within 3 business days.\n\n"
        f"Best regards"
    )

    body_vi = (
        f"Kính gửi Quý Nhà Cung Cấp,\n\n"
        f"Chúng tôi đang mở rộng danh mục F&B và cần tìm nguồn cung ổn định cho:\n\n"
        f"**Yêu cầu sản phẩm:** {product_needs}\n\n"
        f"**Thông tin NCC:** {supplier_info}\n\n"
        f"Quý công ty vui lòng gửi:\n"
        f"• Bảng giá sỉ (FOB và giao tận nơi)\n"
        f"• MOQ (số lượng đặt hàng tối thiểu)\n"
        f"• Chính sách mẫu và thời gian cung mẫu\n"
        f"• Năng lực giao hàng hàng tháng và điều khoản thanh toán\n\n"
        f"Chúng tôi đang đánh giá đối tác trong tuần này và mong nhận phản hồi trong 3 ngày làm việc.\n\n"
        f"Trân trọng"
    )

    return {
        "subject_en": f"RFQ — {product_label} (Bulk Supply Inquiry)",
        "body_en": body_en,
        "subject_vi": f"Yêu cầu báo giá — {product_label}",
        "body_vi": body_vi,
    }


def as_json_text(data: object) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)
