import asyncio
import json
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from api.models.schemas import QueryRequest, QueryResponse, QueryType, PipelineEvent
from api.services.agent_workflows import agent_workflows
from api.services.pipeline import PipelineEmitter
from api.core.config import settings
from api.core.logger import logger
import openai

app = FastAPI(title="FinSight Vietnam API", version="1.0.0")

_cors_origins = settings.allowed_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials="*" not in _cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Invalid request payload.", "details": exc.errors()}},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "HTTP_ERROR", "message": str(exc.detail)}},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception during request to {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."}}
    )

@app.exception_handler(httpx.HTTPStatusError)
async def httpx_status_exception_handler(request: Request, exc: httpx.HTTPStatusError):
    logger.error(f"Upstream API HTTP error: {exc.response.status_code} — {exc}")
    message = "An upstream service (TinyFish) returned an error."
    if exc.response.status_code == 401:
        message = "Invalid TinyFish API key. Check TINYFISH_API_KEY in your .env file."
    elif exc.response.status_code == 429:
        message = "TinyFish rate limit exceeded. Please wait and try again."
    return JSONResponse(
        status_code=502,
        content={"error": {"code": "BAD_GATEWAY", "message": message}},
    )

@app.exception_handler(httpx.RequestError)
async def httpx_request_exception_handler(request: Request, exc: httpx.RequestError):
    logger.error(f"Upstream API network error: {exc}")
    return JSONResponse(
        status_code=502,
        content={"error": {"code": "BAD_GATEWAY", "message": "Failed to communicate with an upstream service (TinyFish)."}}
    )

@app.exception_handler(openai.APIError)
async def openai_exception_handler(request: Request, exc: openai.APIError):
    logger.error(f"OpenAI API Error: {exc}")
    return JSONResponse(
        status_code=502,
        content={"error": {"code": "LLM_ERROR", "message": "Failed to generate synthesis from the LLM."}}
    )

def _ensure_api_configured() -> None:
    if settings.is_configured:
        return
    raise HTTPException(
        status_code=503,
        detail=(
            "API keys are not configured. Set TINYFISH_API_KEY and OPENAI_API_KEY "
            "in Vercel → Project → Settings → Environment Variables (Production)."
        ),
    )

async def _run_intelligence_query(
    query: str,
    query_type: QueryType,
    emitter: PipelineEmitter | None = None,
) -> QueryResponse:
    _ensure_api_configured()
    try:
        return await asyncio.wait_for(
            agent_workflows.process_query(
                query=query, query_type=query_type, emitter=emitter
            ),
            timeout=settings.workflow_timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        logger.error(
            f"Workflow timed out after {settings.workflow_timeout_seconds}s for query: {query}"
        )
        raise HTTPException(
            status_code=504,
            detail=(
                "Analysis timed out. Intelligence queries need Vercel Pro (60s function limit) "
                "or a shorter query. Try again or reduce source load."
            ),
        ) from exc

@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "ok",
        "configured": settings.is_configured,
        "runtime": settings.runtime,
        "workflow_timeout_seconds": settings.workflow_timeout_seconds,
        "use_search_snippets_only": settings.use_search_snippets_only,
        "analysis_mode": settings.analysis_mode,
        "llm_model": settings.llm_model,
        "cors_origins": settings.allowed_origins,
    }

@app.post("/api/v1/intelligence/query/stream")
async def query_intelligence_stream(request: QueryRequest):
    logger.info(f"Received streaming query: {request.query_type}")
    _ensure_api_configured()
    queue: asyncio.Queue = asyncio.Queue()

    async def on_event(event: PipelineEvent) -> None:
        await queue.put({"type": "pipeline", "data": event.model_dump()})

    emitter = PipelineEmitter(on_event=on_event)

    async def run_workflow() -> None:
        try:
            result = await asyncio.wait_for(
                agent_workflows.process_query(
                    query=request.query,
                    query_type=request.query_type,
                    emitter=emitter,
                ),
                timeout=settings.workflow_timeout_seconds,
            )
            await queue.put({"type": "result", "data": result.model_dump(mode="json")})
        except asyncio.TimeoutError:
            await queue.put(
                {
                    "type": "error",
                    "data": {
                        "message": "Analysis timed out before synthesis could complete.",
                    },
                }
            )
        except Exception as exc:
            logger.exception("Streaming intelligence workflow failed")
            await queue.put({"type": "error", "data": {"message": str(exc)}})
        finally:
            await queue.put(None)

    async def event_generator():
        task = asyncio.create_task(run_workflow())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
        finally:
            await task

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@app.post("/api/v1/intelligence/query", response_model=QueryResponse)
async def query_intelligence(request: QueryRequest):
    logger.info(f"Received query request: {request.query_type}")
    return await _run_intelligence_query(request.query, request.query_type)
@app.get("/api/v1/intelligence/query")
async def get_intelligence_query(query: str, query_type: str = "general"):
    """Legacy GET endpoint for quick testing"""
    logger.info(f"Received GET query request: {query_type}")
    return await _run_intelligence_query(
        query,
        QueryType(query_type) if query_type in [q.value for q in QueryType] else QueryType.GENERAL,
    )

@app.get("/api/v1/market/ticker")
async def get_market_ticker():
    response_hcmc = await agent_workflows.process_query(
        query="Current average commercial real estate rent per square meter in Ho Chi Minh City District 1",
        query_type=QueryType.REAL_ESTATE
    )
    
    response_hanoi = await agent_workflows.process_query(
        query="Current average commercial real estate rent per square meter in Hanoi Hoan Kiem District",
        query_type=QueryType.REAL_ESTATE
    )
    
    return {
        "ticker_data": [
            {"label": "HCMC D1 RENT", "value": response_hcmc.results[0].summary[:50] if response_hcmc.results else "Fetching..."},
            {"label": "HANOI HOAN KIEM RENT", "value": response_hanoi.results[0].summary[:50] if response_hanoi.results else "Fetching..."}
        ]
    }
