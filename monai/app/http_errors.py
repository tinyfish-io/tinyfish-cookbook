import logging

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def raise_internal_error(exc: Exception, *, context: str = "request") -> None:
    logger.exception("%s failed", context)
    raise HTTPException(
        status_code=500,
        detail="An internal error occurred. Please try again later.",
    ) from exc
