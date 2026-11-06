import json
import re
from typing import Any

from google import genai
from google.genai import types

from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.pipeline.language import SUPPORTED_LANGUAGES, resolve_language


PLANNER_PROMPT = """
You are the search planner for TruthLens, a claim-verification system.

Your job is to (1) identify the language of a claim, (2) translate it to
English, and (3) create search queries that help investigate it.
You must not decide whether the claim is true or false.

Language detection (detected_language):
- "en": English.
- "hi": Hindi written in Devanagari script.
- "hinglish": Hindi written in Latin script (e.g. "kya ye sach hai"), or a
  mix of Hindi and English words.
- "other": any other language.

claim_en:
- A faithful English translation of the claim. If the claim is already
  English, copy it unchanged. Do not add, remove, or soften any facts.

Search queries:
1. Generate 4 to 6 distinct, useful search queries.
2. Include the main entities, event, or subject of the claim.
3. Search for primary sources, official statements, and reliable reporting.
4. Include a query that searches for evidence contradicting the claim.
5. Preserve important dates, locations, numbers, and names.
6. Do not invent facts or assume the claim is true.
7. Tag every query with its language: "en", "hi", or "other".
8. For "hi" and "hinglish" claims: write 2 or 3 queries in Devanagari Hindi
   (never in Roman-script Hindi) and 2 or 3 queries in English.
9. For "en" claims: write all queries in English.
10. For "other" claims: write most queries in English, and at most two in the
    claim's own language tagged "other".
11. Return only the requested structured output.
"""


class PlannerOutput(dict):
    """Dictionary-compatible planner result."""


def _clean_claim(claim: str) -> str:
    """Validate and normalize a user-provided claim."""

    if not isinstance(claim, str):
        raise TypeError("Claim must be a string.")

    claim = re.sub(r"\s+", " ", claim).strip()

    if not claim:
        raise ValueError("Claim cannot be empty.")

    if len(claim) > 2000:
        raise ValueError("Claim must be 2000 characters or fewer.")

    return claim


def _interleave(first: list[dict], second: list[dict]) -> list[dict]:
    """Alternate two query lists so both languages survive a length cap."""

    merged = []
    for index in range(max(len(first), len(second))):
        if index < len(first):
            merged.append(first[index])
        if index < len(second):
            merged.append(second[index])
    return merged


def generate_queries(claim: str) -> dict[str, Any]:
    """
    Detect the claim's language, translate it, and generate search queries.

    Returns:
        {
            "claim": "...",                  # cleaned original claim
            "claim_en": "...",               # English translation
            "detected_language": "en" | "hi" | "hinglish" | "other",
            "search_queries": ["...", "..."],
            "query_languages": {"query": "en" | "hi" | "other"},
        }
    """

    claim = _clean_claim(claim)

    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=(
                f"{PLANNER_PROMPT}\n\n"
                f"Claim to investigate:\n{claim}"
            ),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "detected_language": {
                            "type": "STRING",
                            "enum": sorted(SUPPORTED_LANGUAGES),
                        },
                        "claim_en": {"type": "STRING"},
                        "search_queries": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "query": {"type": "STRING"},
                                    "language": {
                                        "type": "STRING",
                                        "enum": ["en", "hi", "other"],
                                    },
                                },
                                "required": ["query", "language"],
                            },
                        },
                    },
                    "required": [
                        "detected_language",
                        "claim_en",
                        "search_queries",
                    ],
                },
                temperature=0.2,
            ),
        )

        if not response.text:
            raise RuntimeError("Gemini returned an empty planner response.")

        data = json.loads(response.text)

        detected_language = resolve_language(
            data.get("detected_language"), claim
        )

        claim_en = data.get("claim_en")
        claim_en = (
            re.sub(r"\s+", " ", claim_en).strip()
            if isinstance(claim_en, str)
            else ""
        )
        if not claim_en or detected_language == "en":
            claim_en = claim

        raw_queries = data.get("search_queries", [])

        if not isinstance(raw_queries, list):
            raise ValueError("Planner output must contain a list of queries.")

        cleaned: list[dict[str, str]] = []
        seen = set()

        for item in raw_queries:
            if isinstance(item, str):
                item = {"query": item, "language": "en"}

            if not isinstance(item, dict) or not isinstance(
                item.get("query"), str
            ):
                continue

            query = re.sub(r"\s+", " ", item["query"]).strip()
            language = item.get("language")
            if language not in ("en", "hi", "other"):
                language = "en"

            if query and query.casefold() not in seen:
                cleaned.append({"query": query, "language": language})
                seen.add(query.casefold())

        if not cleaned:
            raise ValueError("Planner did not generate any usable queries.")

        # Guarantee at least one English query for Hindi/Hinglish/other
        # claims, so English-language and international sources are reached.
        if detected_language != "en" and not any(
            q["language"] == "en" for q in cleaned
        ):
            if claim_en.casefold() not in seen:
                cleaned.insert(0, {"query": claim_en, "language": "en"})

        # Interleave English and non-English queries, so the search stage
        # (which caps the number of queries) always covers both.
        english = [q for q in cleaned if q["language"] == "en"]
        local = [q for q in cleaned if q["language"] != "en"]
        ordered = _interleave(local, english) if local else english
        ordered = ordered[:6]

        return {
            "claim": claim,
            "claim_en": claim_en,
            "detected_language": detected_language,
            "search_queries": [q["query"] for q in ordered],
            "query_languages": {q["query"]: q["language"] for q in ordered},
        }

    finally:
        client.close()
