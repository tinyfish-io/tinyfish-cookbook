from fastapi import APIRouter
from pydantic import BaseModel

from app.http_errors import raise_internal_error
from app.services.ai_client import analyze_data, has_openai
from app.services.report_builder import build_outreach_report, build_suppliers_report
from app.services.response_parser import normalize_payload, parse_llm_json
from app.services.search_analysis import as_json_text, outreach_template, suppliers_from_search
from app.services.tinyfish_client import search_tinyfish

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])

SYSTEM_JSON = (
    "You are a senior Vietnam F&B procurement manager. Output ONLY valid JSON. "
    "Write polished, professional copy suitable for immediate business use."
)


class SupplierRequest(BaseModel):
    trend_name: str
    ingredients: list[str]
    location: str


class OutreachRequest(BaseModel):
    supplier_info: str
    product_needs: str


@router.post("/discover")
async def discover_suppliers(request: SupplierRequest):
    """Finds suppliers for specific ingredients related to a trend."""
    try:
        ingredient_str = ", ".join(request.ingredients)
        query = f"wholesale suppliers distributors for {ingredient_str} in {request.location} Vietnam"
        search_results = await search_tinyfish(
            query,
            max_results=15,
            purpose=f"Find suppliers for {ingredient_str} near {request.location}",
        )

        if has_openai():
            prompt = f"""
            Extract suppliers from search results for {request.trend_name}.
            Ingredients: {ingredient_str}
            Location: {request.location}
            Results: {as_json_text(search_results)}

            Return JSON array (max 8) with keys:
            name, contact_info, products_offered, suitability_score (1-10),
            tier (Preferred/Strong fit/Viable/Backup), next_step (1 sentence).
            """
            ai_response = await analyze_data(prompt, SYSTEM_JSON)
            suppliers = parse_llm_json(ai_response)
            if not isinstance(suppliers, list):
                suppliers = suppliers_from_search(search_results)
        else:
            suppliers = suppliers_from_search(search_results)

        suppliers = normalize_payload(suppliers)
        if not isinstance(suppliers, list):
            suppliers = []

        return {
            "trend": request.trend_name,
            "ingredients": request.ingredients,
            "location": request.location,
            "suppliers": suppliers,
            "report": build_suppliers_report(request.trend_name, suppliers),
        }
    except Exception as e:
        raise_internal_error(e, context="supplier discovery")


@router.post("/outreach")
async def generate_outreach(request: OutreachRequest):
    """Generates an RFQ and outreach email in Vietnamese and English."""
    try:
        if has_openai():
            prompt = f"""
            Write a bilingual RFQ email (English + Vietnamese).
            Supplier: {request.supplier_info}
            Products needed: {request.product_needs}

            Return JSON with keys: subject_en, body_en, subject_vi, body_vi.
            Each body must have: greeting, context, bullet list of asks (MOQ, pricing, samples, delivery),
            timeline expectation, professional sign-off. Use paragraph breaks (\\n\\n).
            """
            ai_response = await analyze_data(prompt, SYSTEM_JSON)
            rfq = parse_llm_json(ai_response)
            if not isinstance(rfq, dict):
                rfq = outreach_template(request.supplier_info, request.product_needs)
        else:
            rfq = outreach_template(request.supplier_info, request.product_needs)

        rfq = normalize_payload(rfq)
        return {
            "rfq_template": rfq,
            "report": build_outreach_report(rfq if isinstance(rfq, dict) else {}),
        }
    except Exception as e:
        raise_internal_error(e, context="supplier outreach")
