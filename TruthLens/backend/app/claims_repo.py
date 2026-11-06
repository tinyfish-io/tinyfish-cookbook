import hashlib
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import DESCENDING

from app.db import claims_collection
from app.seen_repo import seen_claim_ids

# --- Rules for what is worth showing publicly ---
MIN_CLAIM_LENGTH = 15
VALID_VERDICTS = {
    "SUPPORTED",
    "REFUTED",
    "INSUFFICIENT_EVIDENCE",
    "UNVERIFIED_NO_AUTHORITATIVE_SOURCES",
}


def normalize_claim(text: str) -> str:
    """Lowercase, strip punctuation/symbols, collapse whitespace.

    Only Unicode punctuation (P*) and symbols (S*) are removed, so Hindi
    vowel signs and other combining marks are preserved.
    """
    text = unicodedata.normalize("NFKC", text).casefold()
    text = "".join(
        " " if unicodedata.category(ch)[0] in "PS" else ch for ch in text
    )
    return re.sub(r"\s+", " ", text).strip()


def make_claim_key(text: str) -> str:
    return hashlib.sha256(normalize_claim(text).encode("utf-8")).hexdigest()


def is_publishable(result: dict[str, Any]) -> bool:
    claim = (result.get("claim") or "").strip()
    verdict = result.get("final_verdict") or result.get("verdict")
    return len(claim) >= MIN_CLAIM_LENGTH and verdict in VALID_VERDICTS


# Sort orders for the community feed. `_id` breaks ties so pages never overlap.
SORT_ORDERS = {
    "recent": [("last_analyzed_at", DESCENDING), ("_id", DESCENDING)],
    "seen": [
        ("seen_count", DESCENDING),
        ("last_analyzed_at", DESCENDING),
        ("_id", DESCENDING),
    ],
}


async def save_analysis(result: dict[str, Any]) -> bool:
    """Insert a new claim or bump the counter on an existing one."""
    if not is_publishable(result):
        return False

    claim = result["claim"].strip()
    now = datetime.now(timezone.utc)
    explanation = result.get("explanation") or {}

    await claims_collection().update_one(
        {"claim_key": make_claim_key(claim)},
        {
            "$set": {
                "verdict": result.get("final_verdict") or result.get("verdict"),
                "consensus_score": result.get("consensus_score"),
                "explanation_snippet": explanation.get("en"),
                "explanation_snippet_hi": explanation.get("hi"),
                "zombie_suspected": bool(result.get("zombie_suspected")),
                "detected_language": result.get("detected_language"),
                "claim_en": result.get("claim_en"),
                "language": result.get("language"),
                "last_analyzed_at": now,
                "report": result,  # full report, used by "View full report"
            },
            "$setOnInsert": {
                "claim": claim,
                "first_analyzed_at": now,
                "seen_count": 0,
            },
            "$inc": {"analysis_count": 1},
        },
        upsert=True,
    )
    return True


def _to_summary(doc: dict[str, Any], seen_by_me: bool = False) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "claim": doc["claim"],
        "verdict": doc.get("verdict"),
        "consensus_score": doc.get("consensus_score"),
        "explanation_snippet": doc.get("explanation_snippet"),
        "explanation_snippet_hi": doc.get("explanation_snippet_hi"),
        "detected_language": doc.get("detected_language") or doc.get("language"),
        "zombie_suspected": doc.get("zombie_suspected", False),
        "analysis_count": doc.get("analysis_count", 1),
        "seen_count": doc.get("seen_count", 0),
        "seen_by_me": seen_by_me,
        "first_analyzed_at": doc["first_analyzed_at"],
        "last_analyzed_at": doc["last_analyzed_at"],
    }


async def list_claims(
    page: int,
    page_size: int,
    sort: str = "recent",
    visitor_id: str | None = None,
) -> dict[str, Any]:
    claims = claims_collection()
    total = await claims.count_documents({})

    cursor = (
        claims.find({}, projection={"report": 0})
        .sort(SORT_ORDERS.get(sort, SORT_ORDERS["recent"]))
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)

    seen_ids = (
        await seen_claim_ids(visitor_id, [d["_id"] for d in docs])
        if visitor_id
        else set()
    )

    return {
        "items": [_to_summary(d, d["_id"] in seen_ids) for d in docs],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": max(1, -(-total // page_size)),
    }


async def get_report(claim_id: str) -> dict[str, Any] | None:
    try:
        oid = ObjectId(claim_id)
    except (InvalidId, TypeError):
        return None
    doc = await claims_collection().find_one({"_id": oid}, projection={"report": 1})
    return doc.get("report") if doc else None