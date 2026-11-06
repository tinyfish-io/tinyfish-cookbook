"""Storage for "I have seen this too" marks and the visitor-token secret."""

import logging
import secrets
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.config import VISITOR_TOKEN_SECRET
from app.db import claim_seen_collection, claims_collection, settings_collection

logger = logging.getLogger(__name__)

_SECRET_ID = "visitor_token_secret"
_secret_cache: str | None = None


async def get_visitor_secret() -> str:
    """Signing secret: the env var if set, else one persisted in MongoDB."""
    global _secret_cache
    if _secret_cache:
        return _secret_cache

    if VISITOR_TOKEN_SECRET:
        _secret_cache = VISITOR_TOKEN_SECRET
        return _secret_cache

    settings = settings_collection()
    try:
        doc = await settings.find_one_and_update(
            {"_id": _SECRET_ID},
            {"$setOnInsert": {"value": secrets.token_hex(32)}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        # Another worker created it at the same moment.
        doc = await settings.find_one({"_id": _SECRET_ID})

    _secret_cache = doc["value"]
    return _secret_cache


def _to_object_id(claim_id: str) -> ObjectId | None:
    try:
        return ObjectId(claim_id)
    except (InvalidId, TypeError):
        return None


async def set_seen(claim_id: str, visitor_id: str, seen: bool) -> dict | None:
    """Mark (``seen=True``) or un-mark (``seen=False``) a claim for a visitor.

    Idempotent: repeating a request changes nothing. Returns ``None`` when the
    claim does not exist.
    """
    oid = _to_object_id(claim_id)
    if oid is None:
        return None

    claims = claims_collection()
    marks = claim_seen_collection()

    if await claims.find_one({"_id": oid}, projection={"_id": 1}) is None:
        return None

    delta = 0
    if seen:
        try:
            await marks.insert_one(
                {
                    "claim_id": oid,
                    "visitor_id": visitor_id,
                    "created_at": datetime.now(timezone.utc),
                }
            )
            delta = 1
        except DuplicateKeyError:
            pass  # already marked by this visitor
    else:
        result = await marks.delete_one({"claim_id": oid, "visitor_id": visitor_id})
        if result.deleted_count:
            delta = -1

    if delta:
        # Keep a counter on the claim so the feed can sort on it with an index.
        doc = await claims.find_one_and_update(
            {"_id": oid},
            {"$inc": {"seen_count": delta}},
            projection={"seen_count": 1},
            return_document=ReturnDocument.AFTER,
        )
    else:
        doc = await claims.find_one({"_id": oid}, projection={"seen_count": 1})

    count = (doc or {}).get("seen_count", 0)
    return {"claim_id": claim_id, "seen_count": max(0, count), "seen_by_me": seen}


async def seen_claim_ids(visitor_id: str, claim_ids: list[ObjectId]) -> set[ObjectId]:
    """Which of ``claim_ids`` this visitor has marked."""
    if not claim_ids:
        return set()
    cursor = claim_seen_collection().find(
        {"visitor_id": visitor_id, "claim_id": {"$in": claim_ids}},
        projection={"claim_id": 1},
    )
    docs = await cursor.to_list(length=len(claim_ids))
    return {d["claim_id"] for d in docs}
