"""TinyFish Research integration (Feature 5) — cited report.

Uses AsyncTinyFish.research.queue() (beta). Research is slow (deep mode: 5-20 min),
so the pipeline queues it once and retrieves it through a status endpoint.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

from .config import get_api_key, has_api_key

QUEUE_TIMEOUT_S = float(os.getenv("RESEARCH_QUEUE_TIMEOUT_S", "30"))


def _status_text(status: Any) -> str:
    return str(getattr(status, "value", status)).upper().split(".")[-1]


def build_query(name: str, site: str | None) -> str:
    site_part = f" Its website is {site}." if site else ""
    return (
        f"Investigate the Indian instant-loan app called \"{name}\"."
        f"{site_part} Cover: who operates it, whether a regulated RBI lending partner"
        " (NBFC/bank) is identified, what the RBI digital lending apps directory shows,"
        " what public complaints or warning signals (harassment, hidden fees, data misuse)"
        " exist, what transparency information (grievance officer, interest rate, address)"
        " is missing, and how a borrower can independently verify it before borrowing."
    )


async def run_research(name: str, site: str | None = None) -> dict[str, Any]:
    """Queue one cited research report. Never raises or waits for deep research."""
    out: dict[str, Any] = {
        "ok": False,
        "status": "queued",
        "report": None,
        "citations": [],
        "run_id": None,
        "research_run_id": None,
        "error": None,
    }
    if not has_api_key():
        out["error"] = "TINYFISH_API_KEY not configured"
        out["status"] = "unavailable"
        return out
    try:
        from tinyfish import AsyncTinyFish  # type: ignore
        client = AsyncTinyFish(api_key=get_api_key(), timeout=60.0, max_retries=0)
    except Exception as exc:  # pragma: no cover
        out["error"] = f"SDK init failed: {exc}"
        out["status"] = "failed"
        return out

    try:
        response = await asyncio.wait_for(
            client.research.queue(query=build_query(name, site), mode="deep"),
            timeout=QUEUE_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        out["status"] = "timed_out"
        out["error"] = f"Research queue timed out after {QUEUE_TIMEOUT_S}s; no run ID was returned"
        return out
    except Exception as exc:
        out["status"] = "unavailable"
        out["error"] = f"{type(exc).__name__}: {exc}"
        out["notice"] = "Research pending or unavailable. Preliminary evidence summary is based on completed Search and Fetch results."
        return out

    out["research_run_id"] = getattr(response, "research_run_id", None)
    out["run_id"] = out["research_run_id"]
    if not out["research_run_id"]:
        out["status"] = "unavailable"
        out["error"] = "Research queue returned no research run ID"
        return out
    out["status"] = "queued"
    out["notice"] = "Research is queued asynchronously. Results are retrieved from TinyFish using this run ID."
    return out


async def get_research_status(run_id: str) -> dict[str, Any]:
    """Retrieve one research run, including the completed report and citations."""
    out: dict[str, Any] = {
        "ok": False, "status": "unavailable", "report": None, "citations": [],
        "run_id": run_id, "research_run_id": run_id, "error": None,
    }
    if not has_api_key():
        out["error"] = "TINYFISH_API_KEY not configured"
        return out
    try:
        from tinyfish import AsyncTinyFish  # type: ignore
        client = AsyncTinyFish(api_key=get_api_key(), timeout=60.0, max_retries=0)
        response = await client.research.get(run_id)
    except Exception as exc:
        out["error"] = f"{type(exc).__name__}: {exc}"
        return out
    raw_status = _status_text(getattr(response, "status", "UNAVAILABLE"))
    out["provider_status"] = raw_status
    status_map = {"QUEUED": "queued", "RUNNING": "running", "COMPLETED": "completed",
                  "FAILED": "failed", "CANCELLED": "cancelled", "TIMED_OUT": "timed_out"}
    out["status"] = status_map.get(raw_status, "unavailable")
    error = getattr(response, "error", None)
    if error:
        out["error"] = getattr(error, "message", str(error))
    deep = getattr(response, "deep_result", None)
    report = getattr(deep, "result", None) if deep else None
    citations = getattr(deep, "citations", None) if deep else None
    if out["status"] == "completed" and report:
        out["report"] = report
        out["citations"] = [
            citation if isinstance(citation, dict)
            else {"title": str(citation), "url": str(citation)}
            for citation in (citations or [])
        ]
        out["ok"] = True
    elif out["status"] == "completed":
        out["status"] = "unavailable"
        out["error"] = "Research completed but returned no deep report"
    elif not out["error"] and out["status"] in {"failed", "cancelled", "timed_out"}:
        out["error"] = f"Research ended with status {raw_status}"
    return out
