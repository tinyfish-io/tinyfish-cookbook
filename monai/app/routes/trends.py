from fastapi import APIRouter

from app.http_errors import raise_internal_error
from app.services.report_builder import build_emerging_report, build_forecast_report, build_regional_report
from app.services.response_parser import normalize_payload, parse_llm_json
from app.services.search_analysis import (
    as_json_text,
    emerging_trends_from_search,
    forecast_from_search,
    regional_comparison_from_search,
)
from app.services.tinyfish_client import search_tinyfish

router = APIRouter(prefix="/api/trends", tags=["Trends"])

SYSTEM_JSON = (
    "You are a senior Vietnam F&B market analyst. Output ONLY valid JSON. "
    "Write in clear, executive-ready English. Use vivid but professional language."
)


@router.get("/emerging")
async def get_emerging_trends(location: str, category: str = "food and beverage"):
    """Detects rapidly growing food trends in a specific location."""
    try:
        query = f"fastest growing {category} trends in {location} Vietnam TikTok Facebook"
        purpose = f"Find emerging {category} trends in {location} for a Vietnamese F&B operator"
        search_results = await search_tinyfish(query, purpose=purpose)

        if has_openai():
            prompt = (
                f"Analyze search results about {category} trends in {location}:\n"
                f"{as_json_text(search_results)}\n\n"
                "Return a JSON array (max 5 items) with keys:\n"
                "trend_name, growth_rate (e.g. '+180%'), description (1-2 sentences), "
                "why_it_matters (1 sentence), signal_strength (1-10), region.\n"
                "Rank by real adoption potential, not clickbait titles."
            )
            ai_response = await analyze_data(prompt, SYSTEM_JSON)
            parsed = parse_llm_json(ai_response)
            trends = parsed if isinstance(parsed, list) else emerging_trends_from_search(search_results, location)
        else:
            trends = emerging_trends_from_search(search_results, location)

        return {
            "location": location,
            "category": category,
            "emerging_trends": trends,
            "report": build_emerging_report(location, trends),
        }

    except Exception as e:
        raise_internal_error(e, context="emerging trends")
async def forecast_trend(trend_name: str, location: str):
    """Predicts mainstream adoption timeline for an emerging trend."""
    try:
        query = f"{trend_name} popularity adoption in {location} Vietnam"
        search_results = await search_tinyfish(query, purpose=f"Forecast adoption of {trend_name} in {location}")

        if has_openai():
            prompt = (
                f"Forecast mainstream adoption of '{trend_name}' in {location}.\n"
                f"Search data:\n{as_json_text(search_results)}\n\n"
                "Return JSON with keys:\n"
                "confidence_score (0-100), projected_mainstream_days (e.g. '30-60'), "
                "reasoning (3 paragraphs of executive prose, no bullet points), "
                "key_drivers (array of 3-5 short strings).\n"
                "Cite operator behavior, social signals, and competitive menu moves where visible."
            )
            ai_response = await analyze_data(prompt, SYSTEM_JSON)
            forecast = parse_llm_json(ai_response)
            if not isinstance(forecast, dict):
                forecast = forecast_from_search(search_results, trend_name, location)
        else:
            forecast = forecast_from_search(search_results, trend_name, location)

        forecast = normalize_payload(forecast)
        if isinstance(forecast, dict):
            forecast.setdefault("location", location)
            forecast.setdefault("trend", trend_name)
            if not forecast.get("sources"):
                forecast["sources"] = [
                    {"title": r.get("title"), "snippet": r.get("snippet"), "url": r.get("url")}
                    for r in search_results.get("results", [])[:5]
                ]

        return {
            "trend": trend_name,
            "location": location,
            "forecast": forecast,
            "report": build_forecast_report(trend_name, location, forecast if isinstance(forecast, dict) else {}),
        }
    except Exception as e:
        raise_internal_error(e, context="trend forecast")
async def compare_regional_trends(region_a: str, region_b: str, category: str = "beverage"):
    """Compares trends between two regions (e.g., Hanoi vs HCMC)."""
    try:
        results_a = await search_tinyfish(
            f"{category} trends in {region_a} Vietnam",
            max_results=5,
            purpose=f"Find {category} trends in {region_a}",
        )
        results_b = await search_tinyfish(
            f"{category} trends in {region_b} Vietnam",
            max_results=5,
            purpose=f"Find {category} trends in {region_b}",
        )

        if has_openai():
            prompt = (
                f"Compare {category} trends: {region_a} vs {region_b}.\n"
                f"{region_a} data:\n{as_json_text(results_a)}\n\n"
                f"{region_b} data:\n{as_json_text(results_b)}\n\n"
                "Return JSON with keys:\n"
                "summary (2-3 paragraphs), region_a_lead_trend, region_b_lead_trend, "
                "region_a_summary (1 paragraph), region_b_summary (1 paragraph), "
                "expansion_opportunities (array of 3 actionable strings)."
            )
            ai_response = await analyze_data(prompt, SYSTEM_JSON)
            comparison = parse_llm_json(ai_response)
            if isinstance(comparison, dict):
                comparison.setdefault("region_a", region_a)
                comparison.setdefault("region_b", region_b)
                comparison.setdefault("category", category)
                comparison.setdefault("region_a_signals", [
                    {"title": r.get("title"), "snippet": r.get("snippet"), "url": r.get("url")}
                    for r in results_a.get("results", [])[:5]
                ])
                comparison.setdefault("region_b_signals", [
                    {"title": r.get("title"), "snippet": r.get("snippet"), "url": r.get("url")}
                    for r in results_b.get("results", [])[:5]
                ])
            else:
                comparison = regional_comparison_from_search(region_a, region_b, results_a, results_b, category)
        else:
            comparison = regional_comparison_from_search(region_a, region_b, results_a, results_b, category)

        comparison = normalize_payload(comparison)
        return {
            "comparison": comparison,
            "report": build_regional_report(comparison if isinstance(comparison, dict) else {}),
        }
    except Exception as e:
        raise_internal_error(e, context="regional comparison")
