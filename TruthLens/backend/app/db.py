import logging

from pymongo import DESCENDING, AsyncMongoClient

from app.config import MONGODB_DB_NAME, MONGODB_URI

logger = logging.getLogger(__name__)

_client: AsyncMongoClient | None = None


def get_db():
    global _client
    if _client is None:
        _client = AsyncMongoClient(
            MONGODB_URI,
            tz_aware=True,
            serverSelectionTimeoutMS=3000,
        )
    return _client[MONGODB_DB_NAME]


def claims_collection():
    return get_db()["claims"]


def claim_seen_collection():
    """One document per (claim, visitor) "I have seen this too" mark."""
    return get_db()["claim_seen"]


def settings_collection():
    return get_db()["settings"]


def challenges_collection():
    """Visitor challenges to community fact-checks. Holds contact emails."""
    return get_db()["challenges"]


async def init_db() -> None:
    claims = claims_collection()
    await claims.create_index("claim_key", unique=True)
    await claims.create_index([("last_analyzed_at", DESCENDING)])
    await claims.create_index([("seen_count", DESCENDING), ("last_analyzed_at", DESCENDING)])
    # Claims saved before this feature have no counter; give them one so the
    # "most seen" sort treats them as 0 instead of pushing them to the end.
    await claims.update_many(
        {"seen_count": {"$exists": False}}, {"$set": {"seen_count": 0}}
    )

    seen = claim_seen_collection()
    # A visitor can mark a claim only once.
    await seen.create_index([("claim_id", 1), ("visitor_id", 1)], unique=True)

    challenges = challenges_collection()
    await challenges.create_index([("claim_id", 1), ("created_at", DESCENDING)])
    await challenges.create_index([("visitor_id", 1), ("created_at", DESCENDING)])
    await challenges.create_index([("status", 1), ("created_at", DESCENDING)])
    logger.info("MongoDB indexes ready")


async def close_db() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None