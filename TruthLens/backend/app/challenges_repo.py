"""Storage for visitor challenges to community fact-checks.

Challenges are only *stored* here. Nothing reads them back out through the
public API, because each one carries the visitor's contact email.
"""

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId

from app.db import challenges_collection, claims_collection

STATUS_OPEN = "open"

# Light abuse guards. They are per anonymous visitor token.
MAX_PER_CLAIM_PER_VISITOR = 3
MAX_PER_VISITOR_PER_DAY = 10


class ChallengeLimitError(Exception):
    """The visitor has submitted too many challenges."""


def _to_object_id(claim_id: str) -> ObjectId | None:
    try:
        return ObjectId(claim_id)
    except (InvalidId, TypeError):
        return None


async def create_challenge(claim_id: str, visitor_id: str, data: dict) -> dict | None:
    """Store a challenge for ``claim_id``.

    ``data`` is a validated ``ChallengeCreate`` dumped to a dict. Returns a
    receipt, or ``None`` if the claim does not exist. Raises
    ``ChallengeLimitError`` when the visitor is over a limit.
    """
    oid = _to_object_id(claim_id)
    if oid is None:
        return None

    claim = await claims_collection().find_one(
        {"_id": oid},
        projection={
            "claim": 1,
            "claim_en": 1,
            "verdict": 1,
            "consensus_score": 1,
            "explanation_snippet": 1,
            "detected_language": 1,
            "analysis_count": 1,
            "last_analyzed_at": 1,
        },
    )
    if claim is None:
        return None

    challenges = challenges_collection()
    now = datetime.now(timezone.utc)

    if await challenges.count_documents(
        {"claim_id": oid, "visitor_id": visitor_id}
    ) >= MAX_PER_CLAIM_PER_VISITOR:
        raise ChallengeLimitError(
            "You have already submitted several challenges for this claim."
        )
    if await challenges.count_documents(
        {"visitor_id": visitor_id, "created_at": {"$gte": now - timedelta(days=1)}}
    ) >= MAX_PER_VISITOR_PER_DAY:
        raise ChallengeLimitError(
            "You have submitted a lot of challenges today. Please try again tomorrow."
        )

    document = {
        "claim_id": oid,
        # What was challenged, as it looked at that moment. A re-analysis
        # replaces the stored report, so the reviewer needs this copy.
        "claim_snapshot": {
            "claim": claim.get("claim"),
            "claim_en": claim.get("claim_en"),
            "verdict": claim.get("verdict"),
            "consensus_score": claim.get("consensus_score"),
            "explanation_snippet": claim.get("explanation_snippet"),
            "detected_language": claim.get("detected_language"),
            "analysis_count": claim.get("analysis_count", 1),
            "last_analyzed_at": claim.get("last_analyzed_at"),
        },
        "challenge_type": data["challenge_type"],
        "suggested_verdict": data.get("suggested_verdict"),
        "explanation": data["explanation"],
        "sources": data["sources"],
        "contact": {"email": data["email"], "name": data.get("name")},
        "contact_consent": data["contact_consent"],
        "visitor_id": visitor_id,
        "status": STATUS_OPEN,
        "created_at": now,
    }
    result = await challenges.insert_one(document)

    return {
        "challenge_id": str(result.inserted_id),
        "status": STATUS_OPEN,
        "created_at": now,
    }
