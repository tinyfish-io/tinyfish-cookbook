import asyncio
import json
import time
import logging
from contextlib import asynccontextmanager
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.challenges_repo import ChallengeLimitError, create_challenge
from app.claims_repo import get_report, list_claims, save_analysis
from app.db import close_db, init_db
from app.models import (
    AnalyzeRequest,
    AnalyzeResponse,
    ChallengeCreate,
    ChallengeReceipt,
    CommunityClaimsPage,
    SeenState,
    VisitorToken,
)
from app.pipeline.orchestrator import orchestrate_claim
from app.seen_repo import get_visitor_secret, set_seen
from app.telegram_bot import router as telegram_router
from app.telegram_bot import start_polling as start_telegram_polling
from app.telegram_bot import stop_polling as stop_telegram_polling
from app.visitor import issue_token, verify_token

# --------------------------------------------------
# Logging
# --------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await init_db()
    except Exception:
        logger.warning(
            "MongoDB unavailable at startup - community fact-checks disabled",
            exc_info=True,
        )
    telegram_task = start_telegram_polling()
    yield
    await stop_telegram_polling(telegram_task)
    await close_db()

app = FastAPI(
    title="TruthLens API",
    description=(
        "AI-powered claim verification using web research, "
        "evidence retrieval, and Gemini-based judgment."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(telegram_router)

# Allow local development frontends and API testing.
# We can restrict this later when deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/")
async def root():
    return {
        "message": "TruthLens API is running",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TruthLens API",
    }


# --------------------------------------------------
# Claim analysis endpoints
# --------------------------------------------------

async def _finalize_result(result: dict, analysis_id: str) -> dict:
    """Shared post-processing for /api/analyze and /api/analyze/stream."""
    result["analysis_id"] = analysis_id
    escalation = result.get("escalation") or {}

    result["escalation_available"] = bool(
        escalation.get("search_keyword", "").strip()
        or escalation.get("portal_id")
    )

    # Store for the Community Fact-Checks feed. Never fail the user's
    # analysis because of a database problem.
    try:
        await save_analysis(result)
    except Exception:
        logger.exception("Failed to store analysis | id=%s", analysis_id)

    return result


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_claim(request: AnalyzeRequest):
    analysis_id = str(uuid4())
    start_time = time.perf_counter()

    logger.info("Analysis started | id=%s", analysis_id)

    try:
        result = await orchestrate_claim(
            claim=request.claim,
            max_sources=request.max_sources,
        )

        result = await _finalize_result(result, analysis_id)

        logger.info(
            "Analysis completed | id=%s | language=%s | verdict=%s | duration=%.2fs",
            analysis_id,
            result.get("detected_language"),
            result.get("verdict"),
            time.perf_counter() - start_time,
        )

        return result

    except ValueError as exc:
        logger.warning(
            "Invalid analysis input | id=%s | error=%s",
            analysis_id,
            str(exc),
        )
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception(
            "Analysis failed | id=%s",
            analysis_id,
        )
        raise HTTPException(
            status_code=500,
            detail=(
                "Claim analysis failed. "
                f"Analysis ID: {analysis_id}"
            ),
        ) from exc

def _sse(event: str, data: dict) -> str:
    """Format one Server-Sent Event frame."""
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


@app.post("/api/analyze/stream")
async def analyze_claim_stream(request: Request, payload: AnalyzeRequest):
    """
    Same analysis as /api/analyze, streamed as Server-Sent Events:

      event: start     {"analysis_id": ...}
      event: progress  {"stage": "planned" | "searched" | "sources" | ..., ...}
      event: result    <full AnalyzeResponse>
      event: error     {"detail": "..."}
    """
    analysis_id = str(uuid4())
    queue: asyncio.Queue = asyncio.Queue()

    async def on_progress(event: dict) -> None:
        await queue.put(("progress", event))

    async def run_analysis() -> None:
        start_time = time.perf_counter()
        logger.info("Streaming analysis started | id=%s", analysis_id)
        try:
            result = await orchestrate_claim(
                claim=payload.claim,
                max_sources=payload.max_sources,
                on_progress=on_progress,
            )
            result = await _finalize_result(result, analysis_id)

            # Validate/shape exactly like the response_model of /api/analyze.
            report = AnalyzeResponse.model_validate(result).model_dump(mode="json")
            await queue.put(("result", report))

            logger.info(
                "Streaming analysis completed | id=%s | verdict=%s | duration=%.2fs",
                analysis_id,
                result.get("verdict"),
                time.perf_counter() - start_time,
            )
        except ValueError as exc:
            logger.warning(
                "Invalid analysis input | id=%s | error=%s", analysis_id, exc
            )
            await queue.put(("error", {"detail": str(exc)}))
        except Exception:
            logger.exception("Streaming analysis failed | id=%s", analysis_id)
            await queue.put((
                "error",
                {"detail": f"Claim analysis failed. Analysis ID: {analysis_id}"},
            ))
        finally:
            await queue.put(None)  # end-of-stream marker

    async def event_stream():
        task = asyncio.create_task(run_analysis())
        try:
            yield _sse("start", {"analysis_id": analysis_id})
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"  # keeps proxies from closing idle streams
                    continue

                if item is None:
                    break
                event, data = item
                yield _sse(event, data)
        finally:
            # Client disconnected (or stream finished): stop any pending work.
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable Nginx response buffering
        },
    )


# --------------------------------------------------
# Community fact-checks
# --------------------------------------------------

async def optional_visitor(
    x_visitor_token: str | None = Header(default=None),
) -> str | None:
    """Visitor ID from a genuine signed token, else ``None`` (never raises)."""
    if not x_visitor_token:
        return None
    try:
        return verify_token(x_visitor_token, await get_visitor_secret())
    except Exception:
        logger.exception("Could not verify visitor token")
        return None


async def require_visitor(
    visitor_id: str | None = Depends(optional_visitor),
) -> str:
    if visitor_id is None:
        raise HTTPException(status_code=401, detail="A valid visitor token is required.")
    return visitor_id


@app.post("/api/visitor", response_model=VisitorToken)
async def create_visitor():
    """Issue an anonymous visitor token. The browser stores it and sends it
    back in the `X-Visitor-Token` header."""
    try:
        return {"visitor_token": issue_token(await get_visitor_secret())}
    except Exception as exc:
        logger.exception("Failed to issue visitor token")
        raise HTTPException(
            status_code=503,
            detail="Community fact-checks are temporarily unavailable.",
        ) from exc


@app.get("/api/community-claims", response_model=CommunityClaimsPage)
async def community_claims(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    sort: Literal["recent", "seen"] = Query("recent"),
    visitor_id: str | None = Depends(optional_visitor),
):
    try:
        return await list_claims(page, page_size, sort, visitor_id)
    except Exception as exc:
        logger.exception("Failed to load community claims")
        raise HTTPException(
            status_code=503,
            detail="Community fact-checks are temporarily unavailable.",
        ) from exc


@app.get("/api/community-claims/{claim_id}", response_model=AnalyzeResponse)
async def community_claim_report(claim_id: str):
    try:
        report = await get_report(claim_id)
    except Exception as exc:
        logger.exception("Failed to load community report")
        raise HTTPException(
            status_code=503,
            detail="Community fact-checks are temporarily unavailable.",
        ) from exc

    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


async def _set_seen(claim_id: str, visitor_id: str, seen: bool) -> dict:
    try:
        state = await set_seen(claim_id, visitor_id, seen)
    except Exception as exc:
        logger.exception("Failed to update 'seen' mark")
        raise HTTPException(
            status_code=503,
            detail="Community fact-checks are temporarily unavailable.",
        ) from exc

    if state is None:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return state


@app.put("/api/community-claims/{claim_id}/seen", response_model=SeenState)
async def mark_claim_seen(claim_id: str, visitor_id: str = Depends(require_visitor)):
    """"I have seen this too". Repeating the request has no extra effect."""
    return await _set_seen(claim_id, visitor_id, True)


@app.delete("/api/community-claims/{claim_id}/seen", response_model=SeenState)
async def unmark_claim_seen(claim_id: str, visitor_id: str = Depends(require_visitor)):
    """Undo "I have seen this too"."""
    return await _set_seen(claim_id, visitor_id, False)


@app.post(
    "/api/community-claims/{claim_id}/challenges",
    response_model=ChallengeReceipt,
    status_code=201,
)
async def submit_challenge(
    claim_id: str,
    payload: ChallengeCreate,
    visitor_id: str = Depends(require_visitor),
):
    """Store a visitor's challenge to a community fact-check.

    Needs `X-Visitor-Token`. Challenges are stored in MongoDB only and are
    not returned by any public endpoint (they contain contact emails).
    """
    try:
        receipt = await create_challenge(claim_id, visitor_id, payload.model_dump())
    except ChallengeLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to store challenge")
        raise HTTPException(
            status_code=503,
            detail="Challenges are temporarily unavailable. Please try again later.",
        ) from exc

    if receipt is None:
        raise HTTPException(status_code=404, detail="Claim not found.")
    return receipt
