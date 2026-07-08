from fastapi import APIRouter
from pydantic import BaseModel

from app.http_errors import raise_internal_error
from app.services.ai_client import analyze_data, has_openai
from app.services.report_builder import build_menu_gap_report
from app.services.response_parser import normalize_payload, parse_llm_json, strip_fabricated_metrics
from app.services.search_analysis import as_json_text, menu_gap_from_search
from app.services.tinyfish_client import fetch_tinyfish, search_tinyfish

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

SYSTEM_JSON = (
    "You are a senior Vietnam F&B menu strategist. Output ONLY valid JSON. "
    "Write recommendations as actionable, specific prose."
)


class MenuGapRequest(BaseModel):
    current_menu_items: list[str]
    location: str
    competitor_urls: list[str] = []


@router.post("/menu-gap")
async def analyze_menu_gap(request: MenuGapRequest):
    """Compares current menu with competitors and emerging trends to find gaps."""
    try:
        trends_query = (
            f"viral trending drinks and street food {request.location} Vietnam "
            f"TikTok GrabFood ShopeeFood menu"
        )
        trends_results = await search_tinyfish(trends_query)

        competitor_menus = []
        for url in request.competitor_urls[:2]:
            try:
                fetched = await fetch_tinyfish(url)
                page = (fetched.get("results") or [{}])[0]
                competitor_menus.append(
                    {
                        "url": url,
                        "title": page.get("title"),
                        "text": (page.get("text") or "")[:4000],
                    }
                )
            except Exception as fetch_err:
                print(f"Failed to fetch {url}: {fetch_err}")

        if has_openai():
            prompt = f"""
            Menu gap analysis for {request.location}.

            Current menu: {request.current_menu_items}
            Trend signals: {as_json_text(trends_results)}
            Competitor pages: {as_json_text(competitor_menus)}

            Return JSON with keys:
            location, current_menu_items, executive_summary (2 sentences),
            missing_opportunities (array max 5). Each opportunity needs:
            trend, priority (High/Medium/Low based on search order only), evidence (from snippets),
            competitor_adoption (from competitor page text when available), recommendation (actionable, no invented timelines).
            Do not invent confidence scores, percentages, or day counts.
            """
            ai_response = await analyze_data(prompt, SYSTEM_JSON)
            analysis = parse_llm_json(ai_response)
            if not isinstance(analysis, dict):
                analysis = menu_gap_from_search(
                    request.current_menu_items,
                    request.location,
                    trends_results,
                    competitor_menus,
                )
            else:
                analysis = strip_fabricated_metrics(analysis)
                analysis.setdefault("trend_signals", [
                    {"title": r.get("title"), "snippet": r.get("snippet"), "url": r.get("url")}
                    for r in trends_results.get("results", [])[:8]
                ])
        else:
            analysis = menu_gap_from_search(
                request.current_menu_items,
                request.location,
                trends_results,
                competitor_menus,
            )

        analysis = normalize_payload(analysis)
        return {
            "menu_gap_analysis": analysis,
            "report": build_menu_gap_report(analysis if isinstance(analysis, dict) else {}),
        }
    except Exception as e:
        raise_internal_error(e, context="menu gap analysis")
