"""FastAPI surface: JSON endpoints plus an SSE progress stream and a static dashboard.

The event names live in `events.py` and are exposed at `GET /api/events`. The dashboard
reads them from there instead of hard-coding strings, so a renamed event can never leave
the client waiting on a message the server stopped sending.
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import __version__, events
from .config import SourceSpec, load_settings, load_sources, slugify
from .report import render_json, render_markdown
from .scanner import any_breaking, scan_all
from .store import Store
from .tinyfish_client import TinyFishFetcher

logger = logging.getLogger(__name__)

load_dotenv()

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
_HTTP_PREFIXES = ("http://", "https://")

settings = load_settings()
_store: Store | None = None


def get_store() -> Store:
    """Lazily open the snapshot store so importing this module writes nothing."""

    global _store
    if _store is None:
        _store = Store(settings.db_path)
    return _store


class SourceIn(BaseModel):
    """Body for POST /api/sources."""

    url: str = Field(..., min_length=8, max_length=2048)
    label: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(default=None, max_length=80)


class ScanIn(BaseModel):
    """Body for POST /api/scan — omit to scan every watched source."""

    slug: str | None = Field(default=None, max_length=120)


def seed_from_config(config_path: Path | None = None) -> int:
    """Load `sources.yaml` into an empty store. Returns how many sources were added.

    Only runs when the store has no sources at all, so a scan never resurrects a URL
    that was deliberately deleted through the API.
    """

    store = get_store()
    if store.count_sources():
        return 0

    path = config_path or settings.config_path
    try:
        specs = load_sources(path)
    except FileNotFoundError:
        logger.info("no watchlist at %s, starting empty", path)
        return 0

    for spec in specs:
        store.upsert_source(spec.slug, spec.url, spec.label)
    logger.info("seeded %d source(s) from %s", len(specs), path)
    return len(specs)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    seed_from_config()
    yield


app = FastAPI(
    title="Docs Drift Radar",
    description="Watch documentation pages with the TinyFish Fetch endpoint and report what changed.",
    version=__version__,
    lifespan=lifespan,
)


@app.get("/", include_in_schema=False)
async def dashboard() -> Any:
    """The vanilla-JS dashboard. No build step, no npm."""

    index = STATIC_DIR / "index.html"
    if not index.exists():
        raise HTTPException(status_code=404, detail="dashboard asset missing")
    return FileResponse(index)


@app.get("/api/health")
async def health() -> dict[str, Any]:
    store = get_store()
    return {
        "status": "ok",
        "version": __version__,
        "sources": store.count_sources(),
        "drifts": len(store.list_drifts(limit=1000)),
        "api_key_configured": bool(settings.api_key),
    }


@app.get("/api/events")
async def event_contract() -> dict[str, Any]:
    """The scan progress contract, so clients never hard-code it."""

    return {
        "events": list(events.SCAN_EVENTS),
        "outcomes": list(events.OUTCOMES),
        "descriptions": {
            events.SOURCE_START: "fetch started for one source",
            events.SOURCE_COMPLETE: "fetch finished (changed, unchanged, or first_seen)",
            events.SOURCE_ERROR: "fetch failed for one source",
            events.SCAN_COMPLETE: "all sources finished; carries every outcome",
        },
    }


def _require_http_url(raw: str) -> str:
    url = raw.strip()
    if not url.lower().startswith(_HTTP_PREFIXES):
        raise HTTPException(status_code=400, detail="url must start with http:// or https://")
    return url


@app.get("/api/sources")
async def list_sources() -> dict[str, Any]:
    return {"sources": get_store().list_sources()}


@app.post("/api/sources", status_code=201)
async def add_source(payload: SourceIn) -> dict[str, Any]:
    store = get_store()
    url = _require_http_url(payload.url)
    slug = (payload.slug or slugify(url)).strip()
    source = store.upsert_source(slug, url, (payload.label or url).strip())
    return {"source": source}


@app.delete("/api/sources/{slug}")
async def delete_source(slug: str) -> dict[str, Any]:
    if not get_store().delete_source(slug):
        raise HTTPException(status_code=404, detail=f"unknown source: {slug}")
    return {"deleted": slug}


@app.get("/api/drifts")
async def list_drifts(
    limit: int = 50,
    slug: str | None = None,
    since: str | None = None,
) -> dict[str, Any]:
    drifts = get_store().list_drifts(limit=limit, slug=slug, since=since)
    return {"count": len(drifts), "drifts": drifts}


@app.get("/api/report")
async def report(
    format: str = "json",
    limit: int = 50,
    slug: str | None = None,
    since: str | None = None,
) -> Any:
    """`?format=md` returns the markdown report as plain text; anything else is JSON."""

    drifts = get_store().list_drifts(limit=limit, slug=slug, since=since)
    if format == "md":
        return PlainTextResponse(render_markdown(drifts, since=since))
    if format != "json":
        raise HTTPException(status_code=400, detail="format must be 'md' or 'json'")
    return render_json(drifts, since=since)


@app.post("/api/scan")
async def scan(payload: ScanIn | None = None) -> StreamingResponse:
    """Fetch every watched source, streaming progress as Server-Sent Events."""

    store = get_store()
    sources = store.list_sources()

    if payload is not None and payload.slug:
        sources = [source for source in sources if source["slug"] == payload.slug]
        if not sources:
            raise HTTPException(status_code=404, detail=f"unknown source: {payload.slug}")

    if not sources:
        raise HTTPException(
            status_code=409,
            detail="nothing to scan — add a URL or seed sources.yaml",
        )
    if not settings.api_key:
        raise HTTPException(
            status_code=503,
            detail="TINYFISH_API_KEY is not set — copy .env.example to .env first",
        )

    specs = [
        SourceSpec(slug=source["slug"], url=source["url"], label=source["label"])
        for source in sources
    ]
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def emit(event: dict[str, Any]) -> None:
        await queue.put(event)

    async def run() -> None:
        try:
            fetcher = TinyFishFetcher(
                settings.api_key,
                timeout=settings.timeout_seconds,
                max_retries=settings.max_retries,
            )
            outcomes = await scan_all(
                specs,
                fetcher=fetcher,
                store=store,
                concurrency=settings.concurrency,
                emit=emit,
            )
            await queue.put(
                {
                    "type": events.SCAN_COMPLETE,
                    "scanned": len(outcomes),
                    "changed": sum(
                        1 for outcome in outcomes if outcome.status == events.OUTCOME_CHANGED
                    ),
                    "errors": sum(
                        1 for outcome in outcomes if outcome.status == events.OUTCOME_ERROR
                    ),
                    "breaking": any_breaking(outcomes),
                    "outcomes": [outcome.as_event() for outcome in outcomes],
                }
            )
        except Exception as exc:  # noqa: BLE001 — reported to the client, then the stream ends
            logger.exception("scan failed")
            await queue.put(
                {
                    "type": events.SOURCE_ERROR,
                    "slug": None,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
        finally:
            await queue.put(None)

    async def frames() -> AsyncIterator[str]:
        task = asyncio.create_task(run())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
        finally:
            await task

    return StreamingResponse(
        frames(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Proxies that buffer would defeat the point of streaming.
            "X-Accel-Buffering": "no",
        },
    )
