"""Build human-readable intelligence reports with ready-to-use copy."""

from __future__ import annotations

from typing import Any


def _paragraphs(text: str) -> list[str]:
    if not text:
        return []
    chunks = [part.strip() for part in text.replace("\r", "").split("\n") if part.strip()]
    if len(chunks) > 1:
        return chunks
    sentences = [s.strip() for s in text.split(". ") if s.strip()]
    if len(sentences) <= 2:
        return [text.strip()] if text.strip() else []
    grouped: list[str] = []
    buffer: list[str] = []
    for sentence in sentences:
        chunk = sentence if sentence.endswith(".") else f"{sentence}."
        buffer.append(chunk)
        if len(buffer) >= 2:
            grouped.append(" ".join(buffer))
            buffer = []
    if buffer:
        grouped.append(" ".join(buffer))
    return grouped


def _report_shell(
    headline: str,
    *,
    subtitle: str = "",
    paragraphs: list[str] | None = None,
    metrics: list[dict[str, str]] | None = None,
    sections: list[dict[str, Any]] | None = None,
    bullets: list[str] | None = None,
    sources: list[dict[str, str]] | None = None,
    actions: list[str] | None = None,
    cards: list[dict[str, str]] | None = None,
    ready_to_use: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    return {
        "headline": headline,
        "subtitle": subtitle,
        "paragraphs": paragraphs or [],
        "metrics": metrics or [],
        "sections": sections or [],
        "bullets": bullets or [],
        "sources": sources or [],
        "actions": actions or [],
        "cards": cards or [],
        "ready_to_use": ready_to_use or [],
    }


def _sources_from_payload(items: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    if not items:
        return []
    out = []
    for item in items[:6]:
        out.append(
            {
                "title": str(item.get("title") or item.get("trend_name") or "Source"),
                "excerpt": str(item.get("excerpt") or item.get("snippet") or item.get("description") or ""),
                "url": str(item.get("url") or item.get("source_url") or item.get("contact_info") or ""),
            }
        )
    return out


def _rank_label(item: dict[str, Any]) -> str:
    rank = item.get("display_rank") or item.get("search_rank")
    if rank is not None:
        return f"#{rank}"
    return "—"


def build_emerging_report(
    location: str,
    trends: list[dict[str, Any]],
    *,
    category: str = "food and beverage",
) -> dict[str, Any]:
    top = trends[0] if trends else {}
    top_name = top.get("trend_name", "—")
    sources = _sources_from_payload(trends)

    cards = [
        {
            "title": t.get("trend_name", "Trend"),
            "subtitle": f"{_rank_label(t)} · {t.get('publisher', 'web')}",
            "body": t.get("description") or t.get("why_it_matters") or "",
            "tag": t.get("region", location),
        }
        for t in trends[:5]
    ]

    bullets = [
        f"**{t.get('trend_name')}** ({_rank_label(t)}) — {t.get('description', '')}"
        for t in trends[:5]
    ]

    why_text = _paragraphs(str(top.get("why_it_matters") or top.get("description") or ""))
    summary_paragraphs = why_text or (
        [f"Live TinyFish search returned **{len(trends)}** signals for *{location}*."]
        if trends
        else [f"No live search signals were returned for *{location}*."]
    )

    return _report_shell(
        headline=f"Emerging F&B Trends — {location}",
        subtitle=f"{len(trends)} {category} signals from live TinyFish search",
        paragraphs=summary_paragraphs,
        metrics=[
            {"label": "Market", "value": location},
            {"label": "Category", "value": category},
            {"label": "Signals", "value": str(len(trends))},
            {"label": "Top signal", "value": str(top_name)},
            {"label": "Top rank", "value": _rank_label(top)},
        ],
        sections=[
            {
                "title": f"Top signal — {top_name}",
                "paragraphs": why_text[:1],
            },
        ] if top and why_text else [],
        cards=cards,
        bullets=bullets,
        sources=sources,
        actions=[
            f"Review source evidence for *{top_name}* before menu changes." if top else "Run another search with a narrower location or category.",
            "Validate signals against your POS and delivery app data.",
        ],
        ready_to_use=[
            {
                "label": "Trend digest (email)",
                "text": (
                    f"Subject: F&B trend signals — {location}\n\n"
                    f"Team,\n\n"
                    f"Live TinyFish search returned {len(trends)} signals for *{location}*:\n\n"
                    + "\n".join(f"• {b.replace('**', '')}" for b in bullets)
                    + (f"\n\nTop signal: {top_name} ({_rank_label(top)})." if top else "")
                    + "\n\n— MónAI Intelligence"
                ),
            },
        ],
    )


def build_forecast_report(trend: str, location: str, forecast: dict[str, Any]) -> dict[str, Any]:
    signal_count = forecast.get("signal_count")
    reasoning = str(forecast.get("reasoning") or forecast.get("summary") or "")
    drivers = forecast.get("key_drivers") or []
    sources = _sources_from_payload(forecast.get("sources"))

    evidence_label = f"{signal_count} signals" if signal_count is not None else "Live search"
    paragraphs = _paragraphs(reasoning) or [
        f"TinyFish search returned signals for *{trend}* in *{location}*.",
        "Review linked sources and validate timing with your own store data.",
    ]

    metrics = [
        {"label": "Trend", "value": trend},
        {"label": "Location", "value": location},
    ]
    if signal_count is not None:
        metrics.append({"label": "Signals", "value": str(signal_count)})

    return _report_shell(
        headline=f"{trend} — Adoption Signal Summary",
        subtitle=f"Market: {location} · Evidence: {evidence_label}",
        paragraphs=paragraphs,
        metrics=metrics,
        sections=[
            {
                "title": "Source-derived drivers",
                "bullets": [str(driver) for driver in drivers if driver],
            },
        ] if drivers else [],
        sources=sources,
        actions=[
            "Review linked sources before changing procurement or menu plans.",
            "Cross-check social mentions with your own sales data.",
        ],
        ready_to_use=[
            {
                "label": "Internal product memo",
                "text": (
                    f"Subject: {trend} — adoption signals ({location})\n\n"
                    f"Team,\n\n"
                    f"TinyFish returned {evidence_label} for this trend.\n\n"
                    f"{paragraphs[0]}\n\n"
                    f"— Product Strategy"
                ),
            },
            {
                "label": "Leadership update",
                "text": (
                    f"*{trend}* — {evidence_label} in *{location}*. "
                    f"{paragraphs[0]}"
                ),
            },
        ],
        bullets=[
            "Use source excerpts below as evidence, not as a forecast timeline.",
            "Confirm supplier availability before committing to an LTO.",
        ],
    )


def build_regional_report(comparison: dict[str, Any]) -> dict[str, Any]:
    region_a = comparison.get("region_a", "Region A")
    region_b = comparison.get("region_b", "Region B")
    category = comparison.get("category", "F&B")
    lead_a = comparison.get("region_a_lead_trend", "—")
    lead_b = comparison.get("region_b_lead_trend", "—")
    summary = str(comparison.get("summary") or comparison.get("analysis") or "")
    opportunities = comparison.get("expansion_opportunities") or []

    paragraphs = _paragraphs(summary) if summary else [
        f"Side-by-side TinyFish search signals for *{category}* in *{region_a}* versus *{region_b}*.",
    ]

    sections = [
        {
            "title": f"{region_a} — local signals",
            "paragraphs": _paragraphs(str(comparison.get("region_a_summary", ""))),
            "bullets": [s.get("title", "") for s in (comparison.get("region_a_signals") or [])[:3] if s.get("title")],
        },
        {
            "title": f"{region_b} — local signals",
            "paragraphs": _paragraphs(str(comparison.get("region_b_summary", ""))),
            "bullets": [s.get("title", "") for s in (comparison.get("region_b_signals") or [])[:3] if s.get("title")],
        },
    ]

    sources = _sources_from_payload(comparison.get("region_a_signals")) + _sources_from_payload(
        comparison.get("region_b_signals")
    )

    return _report_shell(
        headline=f"Regional Comparison — {region_a} vs {region_b}",
        subtitle=f"Category: {category} · Lead trends: {lead_a} / {lead_b}",
        paragraphs=paragraphs,
        metrics=[
            {"label": "Region A", "value": str(region_a)},
            {"label": "Region B", "value": str(region_b)},
            {"label": "Category", "value": str(category)},
            {"label": "A lead trend", "value": str(lead_a)},
            {"label": "B lead trend", "value": str(lead_b)},
        ],
        sections=sections,
        sources=sources[:8],
        bullets=opportunities if isinstance(opportunities, list) else [],
        actions=[
            f"Compare lead signals between {region_a} ({lead_a}) and {region_b} ({lead_b}).",
            "Use source links to validate whether a lead trend fits your brand.",
        ],
        ready_to_use=[
            {
                "label": "Regional signal brief",
                "text": (
                    f"Subject: Regional search signals — {region_a} vs {region_b}\n\n"
                    f"**Category:** {category}\n"
                    f"**{region_a} lead:** {lead_a}\n"
                    f"**{region_b} lead:** {lead_b}\n\n"
                    f"{paragraphs[0]}\n\n"
                    f"— Expansion Team"
                ),
            },
        ],
    )


def build_menu_gap_report(analysis: dict[str, Any]) -> dict[str, Any]:
    location = analysis.get("location", "your market")
    missing = analysis.get("missing_opportunities") or []
    menu = analysis.get("current_menu_items") or []
    executive = analysis.get("executive_summary") or ""

    cards = [
        {
            "title": str(item.get("trend", "Opportunity")),
            "subtitle": f"{item.get('priority', 'Medium')} priority",
            "body": str(item.get("recommendation") or item.get("evidence") or ""),
            "tag": location,
        }
        for item in missing[:5]
    ]

    bullets = [
        f"**[{item.get('priority', 'Medium')}]** {item.get('trend')}: {item.get('recommendation', item.get('evidence', ''))}"
        for item in missing[:5]
    ]

    paragraphs = _paragraphs(executive) if executive else [
        f"Compared **{len(menu)}** menu items against live TinyFish signals in *{location}*.",
        f"Found **{len(missing)}** gaps where search signals do not overlap your current menu.",
    ]

    sources = _sources_from_payload(analysis.get("trend_signals"))

    return _report_shell(
        headline="Menu Gap Analysis",
        subtitle=f"Location: {location} · {len(missing)} opportunities · {len(menu)} items reviewed",
        paragraphs=paragraphs,
        metrics=[
            {"label": "Menu items reviewed", "value": str(len(menu))},
            {"label": "Gap opportunities", "value": str(len(missing))},
            {"label": "High priority", "value": str(sum(1 for m in missing if m.get("priority") == "High"))},
            {"label": "Market", "value": str(location)},
        ],
        sections=[
            {
                "title": "Current menu baseline",
                "bullets": menu[:10],
            },
        ],
        cards=cards,
        bullets=bullets,
        sources=sources,
        actions=[
            "Review the highest-priority gap using the linked source evidence.",
            "Compare recommendations against your current menu and margin targets.",
        ],
        ready_to_use=[
            {
                "label": "Chef & R&D briefing",
                "text": (
                    f"Chef brief — menu gap review ({location})\n\n"
                    f"**Current core menu:**\n"
                    + "\n".join(f"• {item}" for item in menu)
                    + "\n\n**Gaps from live search:**\n"
                    + "\n".join(f"• {b.replace('**', '')}" for b in bullets)
                ),
            },
        ],
    )


def build_suppliers_report(trend: str, suppliers: list[dict[str, Any]]) -> dict[str, Any]:
    top = suppliers[0] if suppliers else {}
    cards = [
        {
            "title": str(s.get("name", "Supplier")),
            "subtitle": f"Search rank #{s.get('search_rank', '—')}",
            "body": str(s.get("products_offered") or s.get("next_step") or ""),
            "tag": trend,
        }
        for s in suppliers[:6]
    ]

    bullets = [
        f"**{s.get('name')}** (rank #{s.get('search_rank', '—')}) — {s.get('products_offered', '')}"
        for s in suppliers[:8]
    ]

    return _report_shell(
        headline=f"Supplier Shortlist — {trend}",
        subtitle=f"{len(suppliers)} candidates ranked · Top pick: {top.get('name', '—')}",
        paragraphs=[
            f"TinyFish search returned **{len(suppliers)}** supplier results for *{trend}*.",
            "Use search rank and snippets below to shortlist outreach targets.",
        ],
        metrics=[
            {"label": "Trend", "value": trend},
            {"label": "Suppliers found", "value": str(len(suppliers))},
            {"label": "Top pick", "value": str(top.get("name", "—"))},
            {"label": "Top search rank", "value": f"#{top.get('search_rank', '—')}"},
        ],
        cards=cards,
        bullets=bullets,
        sources=_sources_from_payload(
            [{"title": s.get("name"), "url": s.get("contact_info"), "snippet": s.get("products_offered")} for s in suppliers]
        ),
        actions=[
            "Contact suppliers using the RFQ tab when you are ready to source.",
            "Request quotes and sample policy from the highest-ranked results first.",
        ],
        ready_to_use=[
            {
                "label": "Procurement outreach (short)",
                "text": (
                    f"Hello,\n\n"
                    f"We are reviewing suppliers for **{trend}**.\n\n"
                    f"Could you share MOQ, tiered pricing, sample policy, and delivery capacity?\n\n"
                    f"Best regards"
                ),
            },
            {
                "label": "Internal sourcing memo",
                "text": (
                    f"Sourcing memo — {trend}\n\n"
                    f"TinyFish returned {len(suppliers)} supplier results. "
                    f"Top listed result: **{top.get('name', '—')}**.\n\n"
                    + "\n".join(f"• {b.replace('**', '')}" for b in bullets[:5])
                ),
            },
        ],
    )


def build_outreach_report(rfq: dict[str, Any]) -> dict[str, Any]:
    subject_en = rfq.get("subject_en", "RFQ — Ingredient supply")
    body_en = rfq.get("body_en", "")
    subject_vi = rfq.get("subject_vi", "Yêu cầu báo giá")
    body_vi = rfq.get("body_vi", "")

    return _report_shell(
        headline="RFQ & Supplier Outreach",
        subtitle="Bilingual, send-ready templates · Personalize quantities before sending",
        paragraphs=[
            "Bilingual RFQ templates generated from your product needs and supplier details.",
            "Personalize quantities and delivery terms before sending.",
        ],
        sections=[
            {
                "title": "What to ask for",
                "bullets": [
                    "Bulk pricing tiers (FOB and delivered)",
                    "MOQ and reorder lead time",
                    "Sample policy and certification (if applicable)",
                    "Payment terms and monthly capacity",
                ],
            },
        ],
        actions=[
            "Send the RFQ to your shortlisted suppliers.",
            "Log responses in your procurement tracker.",
        ],
        ready_to_use=[
            {"label": "Email — English", "text": f"Subject: {subject_en}\n\n{body_en}"},
            {"label": "Email — Tiếng Việt", "text": f"Subject: {subject_vi}\n\n{body_vi}"},
            {
                "label": "Follow-up",
                "text": (
                    f"Subject: Re: {subject_en}\n\n"
                    f"Hi,\n\nFollowing up on our RFQ below. "
                    f"Could you confirm MOQ and pricing tiers when convenient?\n\n"
                    f"Thank you"
                ),
            },
        ],
    )
