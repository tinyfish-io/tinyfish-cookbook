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


def build_emerging_report(location: str, trends: list[dict[str, Any]]) -> dict[str, Any]:
    top = trends[0] if trends else {}
    top_name = top.get("trend_name", "Emerging trend")
    sources = _sources_from_payload(trends)

    cards = [
        {
            "title": t.get("trend_name", "Trend"),
            "subtitle": f"{t.get('growth_rate', 'trending')} · Signal {t.get('signal_strength', '—')}/10",
            "body": t.get("description") or t.get("why_it_matters") or "",
            "tag": t.get("region", location),
        }
        for t in trends[:5]
    ]

    bullets = [
        f"**{t.get('trend_name')}** ({t.get('growth_rate', 'trending')}) — {t.get('description', '')}"
        for t in trends[:5]
    ]

    why_text = _paragraphs(top.get("why_it_matters") or top.get("description") or "")

    return _report_shell(
        headline=f"Emerging F&B Trends — {location}",
        subtitle=f"{len(trends)} high-velocity signals · Updated from live TinyFish web intelligence",
        paragraphs=[
            f"The **strongest near-term opportunity** in *{location}* is **{top_name}**, "
            f"backed by top-ranked search and social signals.",
            "Rather than chasing every signal, **prioritize one hero launch** for a 14-day pilot, "
            "then expand based on attach rate and margin.",
            "Use the weekly digest below for your innovation stand-up or category review.",
        ],
        metrics=[
            {"label": "Market", "value": location},
            {"label": "Trends tracked", "value": str(len(trends))},
            {"label": "Top signal", "value": str(top_name)},
            {"label": "Lead growth rate", "value": str(top.get("growth_rate", "—"))},
        ],
        sections=[
            {
                "title": f"Why {top_name} leads",
                "paragraphs": [why_text[0]] if why_text else [],
            },
        ] if top else [],
        cards=cards,
        bullets=bullets,
        sources=sources,
        actions=[
            f"Shortlist *{top_name}* for R&D tasting this week.",
            "Assign one store cluster for a controlled LTO pilot.",
            "Monitor TikTok and delivery app mentions daily during the pilot.",
        ],
        ready_to_use=[
            {
                "label": "Weekly trend digest (email)",
                "text": (
                    f"Subject: Weekly F&B Trend Pulse — {location}\n\n"
                    f"Team,\n\n"
                    f"Here are the top emerging trends for *{location}* this week:\n\n"
                    + "\n".join(f"• {b.replace('**', '')}" for b in bullets)
                    + f"\n\n**Recommended focus:** {top_name}\n"
                    f"**Next step:** 14-day LTO at 3 flagship locations.\n\n"
                    f"— MónAI Intelligence"
                ),
            },
            {
                "label": "Innovation stand-up talking points",
                "text": (
                    f"1. Top trend: *{top_name}* ({top.get('growth_rate', 'trending')})\n"
                    f"2. Question: Can we launch an LTO in 10 days?\n"
                    f"3. Blocker: Ingredient MOQ and prep training\n"
                    f"4. Decision needed: Pilot city selection"
                ),
            },
        ],
    )


def build_forecast_report(trend: str, location: str, forecast: dict[str, Any]) -> dict[str, Any]:
    score = forecast.get("confidence_score")
    days = forecast.get("projected_mainstream_days") or forecast.get("timeline")
    reasoning = str(forecast.get("reasoning") or forecast.get("summary") or "")
    drivers = forecast.get("key_drivers") or []
    sources = _sources_from_payload(forecast.get("sources"))

    score_label = f"{score}/100" if score is not None else "Pending"
    days_label = str(days) if days else "TBD"
    paragraphs = _paragraphs(reasoning) or [
        f"Live web signals for *{trend}* in *{location}* indicate measurable consumer and operator interest.",
        "Validate against your POS mix before committing to a national rollout.",
    ]

    return _report_shell(
        headline=f"{trend} — Mainstream Adoption Forecast",
        subtitle=f"Market: {location} · Confidence {score_label} · Timeline {days_label} days",
        paragraphs=paragraphs,
        metrics=[
            {"label": "Trend", "value": trend},
            {"label": "Location", "value": location},
            {"label": "Confidence", "value": score_label},
            {"label": "Mainstream window", "value": f"{days_label} days"},
        ],
        sections=[
            {
                "title": "Key adoption drivers",
                "bullets": drivers if drivers else ["Operator menu additions", "Social UGC volume", "Delivery app visibility"],
            },
        ],
        sources=sources,
        actions=[
            "Brief R&D and procurement within 48 hours.",
            "Run a 2-week LTO in 3 high-traffic stores.",
            "Secure hero ingredients before competitor menu saturation.",
            "Track daily sell-through vs. baseline beverages.",
        ],
        ready_to_use=[
            {
                "label": "Internal product memo",
                "text": (
                    f"Subject: {trend} adoption outlook — {location}\n\n"
                    f"Team,\n\n"
                    f"Our intelligence scan estimates **mainstream adoption within {days_label} days** "
                    f"(confidence **{score_label}**).\n\n"
                    f"**Executive summary:** {paragraphs[0]}\n\n"
                    f"**Recommended action:** Brief R&D and procurement this week; run a 2-week LTO pilot "
                    f"before competitors saturate the category.\n\n"
                    f"— Product Strategy"
                ),
            },
            {
                "label": "Leadership Slack update",
                "text": (
                    f"*{trend}* is accelerating in *{location}*. "
                    f"Forecast: mainstream in ~{days_label} days ({score_label} confidence). "
                    f"Suggest fast-track tasting + supplier quotes."
                ),
            },
            {
                "label": "Social teaser (EN + VI)",
                "text": (
                    f"EN: Trend alert — {trend} is moving from niche to mainstream in {location}. "
                    f"Is it on your menu yet?\n\n"
                    f"VI: Xu hướng mới — {trend} đang bùng nổ tại {location}. Quán bạn đã có món này chưa?"
                ),
            },
        ],
        bullets=[
            "Validate with store-level sell-through, not just social hype.",
            "Secure supply before peak demand window.",
            "Use LTO pricing to test elasticity before core menu add.",
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
        f"Side-by-side web intelligence for *{category}* in *{region_a}* versus *{region_b}*.",
        "Localize 2–3 hero items per city while keeping a stable national core.",
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
            f"Maintain core menu nationally; localize hero LTOs for {region_a} and {region_b}.",
            "Run A/B pricing tests — northern vs. southern portion sizes may differ.",
            "Align marketing creative to regional taste language and influencers.",
        ],
        ready_to_use=[
            {
                "label": "Expansion strategy brief",
                "text": (
                    f"Subject: Regional menu strategy — {region_a} vs {region_b}\n\n"
                    f"**Category:** {category}\n"
                    f"**{region_a} lead:** {lead_a}\n"
                    f"**{region_b} lead:** {lead_b}\n\n"
                    f"{paragraphs[0]}\n\n"
                    f"**Action:** Keep national core stable; deploy 2–3 localized hero items per region.\n\n"
                    f"— Expansion Team"
                ),
            },
            {
                "label": "Franchise ops note",
                "text": (
                    f"Ops note: Do not force identical LTO calendars in {region_a} and {region_b}. "
                    f"Pilot {lead_b}-style items in {region_a} only if local social volume supports it."
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
        f"Your **{len(menu)}-item menu** was benchmarked against live trend signals in *{location}*.",
        f"We identified **{len(missing)} actionable gaps** where demand is outpacing your current assortment.",
        "Focus on **High** priority items first — they have the strongest operator and social proof.",
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
            "Pick the top High-priority gap for a 14-day LTO.",
            "Train baristas/kitchen on prep SOP before launch day.",
            "Compare pilot attach rate vs. existing bestsellers.",
        ],
        ready_to_use=[
            {
                "label": "Chef & R&D briefing",
                "text": (
                    f"Chef brief — menu gap review ({location})\n\n"
                    f"**Current core menu:**\n"
                    + "\n".join(f"• {item}" for item in menu)
                    + "\n\n**Priority additions to evaluate:**\n"
                    + "\n".join(f"• {b.replace('**', '')}" for b in bullets)
                    + "\n\n**Decision:** Select one High-priority item for pilot launch next week."
                ),
            },
            {
                "label": "Store manager rollout note",
                "text": (
                    f"Managers — we're testing a menu gap opportunity in {location}. "
                    f"Focus on suggestive selling for the new LTO during peak hours. "
                    f"Report daily units sold vs. target."
                ),
            },
        ],
    )


def build_suppliers_report(trend: str, suppliers: list[dict[str, Any]]) -> dict[str, Any]:
    top = suppliers[0] if suppliers else {}
    cards = [
        {
            "title": str(s.get("name", "Supplier")),
            "subtitle": f"Score {s.get('suitability_score', '—')}/10 · {s.get('tier', 'Viable')}",
            "body": str(s.get("products_offered") or s.get("next_step") or ""),
            "tag": trend,
        }
        for s in suppliers[:6]
    ]

    bullets = [
        f"**{s.get('name')}** ({s.get('tier')}, {s.get('suitability_score')}/10) — {s.get('products_offered', '')}"
        for s in suppliers[:8]
    ]

    return _report_shell(
        headline=f"Supplier Shortlist — {trend}",
        subtitle=f"{len(suppliers)} candidates ranked · Top pick: {top.get('name', '—')}",
        paragraphs=[
            f"Sourcing intelligence for *{trend}* surfaced **{len(suppliers)} supplier candidates** "
            f"from live wholesale and distributor search results.",
            "**Contact the top two Preferred/Strong fit options in parallel** to compare MOQ, "
            "sample lead time, and delivered pricing.",
            "Keep Backup tier suppliers warm in case primary MOQ exceeds your launch volume.",
        ],
        metrics=[
            {"label": "Trend", "value": trend},
            {"label": "Suppliers found", "value": str(len(suppliers))},
            {"label": "Top pick", "value": str(top.get("name", "—"))},
            {"label": "Top score", "value": f"{top.get('suitability_score', '—')}/10"},
        ],
        cards=cards,
        bullets=bullets,
        sources=_sources_from_payload(
            [{"title": s.get("name"), "url": s.get("contact_info"), "snippet": s.get("products_offered")} for s in suppliers]
        ),
        actions=[
            "Email top 2 suppliers using the RFQ tab.",
            "Request samples before committing to bulk MOQ.",
            "Compare delivered cost per kg/unit including VAT.",
        ],
        ready_to_use=[
            {
                "label": "Procurement outreach (short)",
                "text": (
                    f"Hello,\n\n"
                    f"We are launching a **{trend}** line and reviewing bulk ingredient suppliers.\n\n"
                    f"Could you share:\n"
                    f"• MOQ and tiered pricing\n"
                    f"• Sample policy\n"
                    f"• Monthly delivery capacity\n\n"
                    f"Best regards"
                ),
            },
            {
                "label": "Internal sourcing memo",
                "text": (
                    f"Sourcing memo — {trend}\n\n"
                    f"Shortlisted {len(suppliers)} suppliers. Top candidate: **{top.get('name', '—')}**.\n\n"
                    + "\n".join(f"• {b.replace('**', '')}" for b in bullets[:5])
                    + "\n\nNext: RFQ sent by EOD; samples requested from top 2."
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
            "These templates are formatted for **immediate supplier outreach**. "
            "Replace placeholder quantities with your actual MOQ targets.",
            "Follow up in **3 business days** if you do not receive pricing tiers and sample policy.",
            "For Vietnamese suppliers, send the **Tiếng Việt** version first; attach English if needed.",
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
            "Send RFQ to top 2 shortlisted suppliers.",
            "Log responses in procurement tracker.",
            "Schedule tasting once samples arrive.",
        ],
        ready_to_use=[
            {"label": "Email — English", "text": f"Subject: {subject_en}\n\n{body_en}"},
            {"label": "Email — Tiếng Việt", "text": f"Subject: {subject_vi}\n\n{body_vi}"},
            {
                "label": "Follow-up (3 days later)",
                "text": (
                    f"Subject: Re: {subject_en}\n\n"
                    f"Hi,\n\nJust following up on our RFQ below. "
                    f"Could you confirm MOQ and pricing tiers when convenient?\n\n"
                    f"We're evaluating partners this week.\n\nThank you"
                ),
            },
        ],
    )
