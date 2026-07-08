from api.models.schemas import QueryType

FACTS_JSON_SCHEMA = """{
  "entities": ["Named banks, brands, districts, regulators mentioned in sources"],
  "answer_status": "direct | partial | indirect | not_answered",
  "answer_rationale": "One sentence on whether the exact query was answered or only adjacent context was found",
  "direct_answer_items": ["Facts that directly answer the query's requested metric / rate / fee / regulation"],
  "verified_metrics": [
    {"label": "metric name", "value": "concrete number only", "unit": "% or VND or null", "source_hint": "host or page title"}
  ],
  "comparisons": [
    {"entity": "name", "primary_metric": "value", "secondary_metric": "value or null", "notes": "source-backed note"}
  ],
  "coverage_gaps": ["What the query asked for but sources did NOT contain — be explicit"],
  "source_quality_notes": ["Which sources were strong vs weak and why"],
  "analytical_angles": ["2-3 angles a desk analyst would still discuss with available evidence"]
}"""

REPORT_JSON_SCHEMA = """{
  "headline": "One-line desk headline (max 12 words, no markdown)",
  "executive_summary": "Single sentence TL;DR for the CFO. Use **bold** for the key rate, amount, or entity.",
  "intelligence_brief": "5-7 paragraphs separated by \\n\\n. Institutional research tone for Vietnam expansion desks. Use **bold** for banks, rates, VND amounts, districts, and market leaders. Use *italic* for regulations, circulars, and product names. Cover: market baseline, quantified evidence, side-by-side comparison, operational/credit implications, risks, second-order effects, and what still needs verification.",
  "key_findings": ["Up to 8 bullets. Format: **Entity** — quantified insight with number and unit"],
  "metrics": [
    {"label": "KPI label", "value": "numeric or text", "unit": "% or VND/m² or null", "change": "+4.2% YoY or null"}
  ],
  "comparison_table": [
    {"entity": "Bank/Brand/Property", "primary_metric": "value", "secondary_metric": "value", "notes": "brief desk note"}
  ],
  "recommendation": "2 paragraphs for the expansion or credit committee. **Bold** the recommended action. Use *italic* for timing or conditions.",
  "data_as_of": "e.g. Q1 2026 or Mar 2026",
  "caveats": ["Up to 6 data limitations or evidence notes — plain text, no markdown"]
}"""

TYPE_FOCUS = {
    QueryType.SME_LOAN: (
        "SME Finance & commercial lending intelligence for Vietnamese banks (VPBank, Techcombank, BIDV, MB, ACB). "
        "Audience: credit committees and SME relationship managers. "
        "Extract: lending rates (%), loan limits (VND), collateral requirements, approval SLA, product names. "
        "comparison_table columns: entity, primary_metric (rate), secondary_metric (term/limit), notes."
    ),
    QueryType.REGULATORY: (
        "Regulatory & compliance intelligence for Vietnam fintech and banking (SBV, MOF, SSC). "
        "Audience: compliance officers and legal desks. "
        "Extract: circular numbers, foreign ownership caps, licensing requirements, effective dates, enactment status. "
        "comparison_table columns: entity, primary_metric (regulation), secondary_metric (cap/limit), notes."
    ),
    QueryType.COMPETITOR: (
        "Competitor & market intelligence for F&B/Retail expansion in Vietnam. "
        "Audience: franchise expansion and strategy teams. "
        "Extract: brand names, storefront density, combo pricing (VND), district, market share signals. "
        "comparison_table columns: entity, primary_metric (price/density), secondary_metric (district/share), notes."
    ),
    QueryType.REAL_ESTATE: (
        "Commercial real estate intelligence for Vietnam expansion (Batdongsan, ChoTot). "
        "Audience: site selection and leasing teams. "
        "Extract: rent per m² (USD or VND), district, lease term, vacancy/yield signals. "
        "comparison_table columns: entity, primary_metric (rent), secondary_metric (district/term), notes."
    ),
    QueryType.MOBILITY: (
        "Mobility & logistics intelligence (Grab, Be, Xanh SM, GrabFood, ShopeeFood) for delivery radius planning. "
        "Audience: ops and logistics expansion teams. "
        "Extract: base fares (VND), per-km rates, delivery fees, wait times, coverage density. "
        "If app pricing is gated, explain the limitation and use only article/press/forum evidence. "
        "comparison_table columns: entity, primary_metric (base fare/fee), secondary_metric (per km/surcharge), notes."
    ),
    QueryType.GENERAL: (
        "Cross-vertical Vietnam B2B market intelligence for enterprise expansion desks. "
        "Lead with quantified facts. comparison_table: entity, primary_metric, secondary_metric, notes."
    ),
}


def build_extraction_prompt(query: str, query_type: QueryType, context: str) -> tuple[str, str]:
    focus = TYPE_FOCUS.get(query_type, TYPE_FOCUS[QueryType.GENERAL])
    system = (
        "You are FinSight's evidence extraction layer for Vietnam market intelligence.\n"
        "Read the source bundle and extract ONLY concrete, source-backed facts.\n"
        "Do not invent numbers. Do not smooth gaps into placeholders.\n"
        "Judge whether the sources directly answer the exact user query, not just a related topic.\n"
        "If the query asks for delivery fees but the sources only mention commission rates, vendor onboarding fees, or market share, "
        "set answer_status to not_answered or indirect.\n"
        "If pricing is app-gated (GrabFood, ShopeeFood, bank portals), say so in coverage_gaps.\n"
        f"QUERY TYPE FOCUS: {focus}\n\n"
        f"JSON SCHEMA:\n{FACTS_JSON_SCHEMA}"
    )
    user = (
        f"QUERY: {query}\n"
        f"QUERY TYPE: {query_type.value}\n\n"
        f"SOURCE DATA:\n{context}\n\n"
        "Return extraction JSON only."
    )
    return system, user


def build_synthesis_prompt(
    query: str,
    query_type: QueryType,
    context: str,
    extracted_facts: str | None = None,
) -> tuple[str, str]:
    focus = TYPE_FOCUS.get(query_type, TYPE_FOCUS[QueryType.GENERAL])

    system = (
        "You are FinSight — an institutional market intelligence engine for Vietnamese "
        "B2B expansion teams in banking, SME finance, real estate leasing, F&B/retail, and mobility.\n\n"
        "PRODUCT CONTEXT:\n"
        "- FinSight serves credit committees, expansion directors, and compliance desks — not consumers.\n"
        "- Output reads like a desk research note or credit memo, not a blog or travel guide.\n"
        "- Data is scraped live from Vietnamese web sources via TinyFish.\n\n"
        "RULES:\n"
        "1. Return ONLY valid JSON matching the schema. Markdown (**bold**, *italic*, \\n\\n paragraphs) "
        "is allowed INSIDE string fields only: executive_summary, intelligence_brief, key_findings, recommendation.\n"
        "2. Use ONLY facts from the source data and extracted facts. Never invent rates, prices, counts, or circular numbers.\n"
        "3. If a metric is not present in sources, OMIT it from metrics/comparison_table — do NOT output "
        "'Unknown', 'Variable', 'N/A', or placeholder VND values.\n"
        "4. Missing data goes in caveats — never fabricate.\n"
        "5. Monetary: VND with separators (65,000 VND) or % for rates. Districts: D1 HCMC, Hoan Kiem Hanoi.\n"
        "6. metrics: only include KPIs with concrete sourced values (target 4-6 when evidence supports it). comparison_table: only rows with real numbers.\n"
        "7. intelligence_brief: must have clear paragraph breaks (\\n\\n) between themes and should be detailed, not terse. Aim for a genuinely comprehensive memo when the source layer is strong.\n"
        "8. Do NOT use # headers or bullet lists inside intelligence_brief — use prose paragraphs only.\n"
        "9. ANALYSIS DEPTH: compare entities side-by-side, explain implications for expansion/credit decisions, "
        "and call out what remains unverified in app-gated or JS-heavy sources. Prefer depth over brevity when evidence is available.\n"
        "10. If EXTRACTED FACTS are provided, treat them as the only admissible evidence base.\n"
        "11. If verified_metrics in EXTRACTED FACTS is empty, write a gap-analysis memo: explain what was searched, "
        "why app-gated pricing blocks verification, and what a desk would need next. Do NOT invent headline metrics.\n"
        "12. If sources lack the specific fee/price/rate asked in the QUERY, executive_summary must state that "
        "verification failed — do not lead with market-share or commission stats as if they answer the query.\n\n"
        f"QUERY TYPE FOCUS: {focus}\n\n"
        f"JSON SCHEMA:\n{REPORT_JSON_SCHEMA}"
    )

    facts_block = (
        f"\n\nEXTRACTED FACTS (admissible evidence base):\n{extracted_facts}\n"
        if extracted_facts
        else ""
    )

    user = (
        f"QUERY: {query}\n"
        f"QUERY TYPE: {query_type.value}\n\n"
        f"SOURCE DATA (live extraction from Vietnamese web):\n{context}"
        f"{facts_block}\n\n"
        "Produce a comparative desk memo with real analysis — not a template fill. "
        "If evidence is strong, be detailed and explicit about implications, cross-source comparisons, risk considerations, and committee-level decision framing. "
        "If evidence is thin, keep metrics sparse and expand caveats/coverage_gaps in prose."
    )

    return system, user
