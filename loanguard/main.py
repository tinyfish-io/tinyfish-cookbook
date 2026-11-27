"""LoanGuard — FastAPI backend.

Endpoints:
  GET  /                    Serve the frontend dashboard.
  GET  /api/investigate      SSE investigation pipeline (name=, site=).
  POST /api/watch            Create an RBI directory monitor (on demand).
  POST /api/webhook         Receive monitor notifications -> stored alerts.
  GET  /api/alerts          Return stored monitor alerts.
  GET  /api/health          Health + configuration status (no secrets).
  GET  /static/*            Static evidence files.

The pipeline streams six TinyFish feature stages over SSE. Research is
non-blocking. Monitor is only created on demand. Demo mode replays clearly
labelled sample data. Live errors are never silently replaced with sample data.
"""

from __future__ import annotations

import json
import os
import asyncio
from typing import Any, AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from services.config import (
    EVIDENCE_DIR,
    PROJECT_ROOT,
    get_api_key,
    get_port,
    get_rbi_url,
    has_api_key,
    is_demo_mode,
)
from services.scoring import Indicators, compute_score
from services.tinyfish_agent import check_rbi_directory, get_rbi_directory_status
from services.tinyfish_browser import capture_screenshot
from services.tinyfish_fetch import fetch_pages
from services.tinyfish_monitor import create_monitor
from services.tinyfish_research import run_research, get_research_status
from services.tinyfish_search import search_loan_app

ALERTS_FILE = os.path.join(PROJECT_ROOT, "demo", "alerts.json")
DISCLAIMER = (
    "LoanGuard provides preliminary risk indicators based on publicly available information. "
    "It is not an RBI service, legal opinion or guarantee of lender legitimacy. RBI's directory "
    "is based on information submitted by regulated entities and is not independently validated by "
    "RBI. Always verify directly with the regulated lender before borrowing."
)
PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL", "https://loanguard-sqcb.onrender.com").rstrip("/")
_active_monitor: dict[str, Any] | None = None
_monitor_lock = asyncio.Lock()

app = FastAPI(title="LoanGuard", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://loanguard-five.vercel.app",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Cache-Control"],
)
os.makedirs(EVIDENCE_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=os.path.join(PROJECT_ROOT, "static")), name="static")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _sse(event: str, payload: dict[str, Any]) -> str:
    service_events = {"search", "agent", "fetch", "browser", "research", "monitor"}
    payload = {
        "type": "service_status" if event in service_events else "investigation",
        "step": event,
        **({"service": event} if event in service_events else {}),
        **payload,
    }
    return f"data: {json.dumps(payload, default=str)}\n\n"


def _load_sample() -> dict[str, Any]:
    with open(os.path.join(PROJECT_ROOT, "demo", "sample_events.json"), encoding="utf-8") as f:
        return json.load(f)


def _build_indicators(rbi: dict, fetch: dict) -> Indicators:
    ind = fetch.get("indicators", {}) if fetch else {}
    fetch_ok = bool(fetch.get("ok", True)) if fetch else False
    return Indicators(
        rbi_checked=bool(rbi.get("checked", False)),
        rbi_found=bool(rbi.get("found", False)),
        fetch_checked=fetch_ok,
        grievance_found=bool(ind.get("grievance_found", False)),
        lending_partner_found=bool(ind.get("lending_partner_found", False)),
        address_found=bool(ind.get("address_found", False)),
        interest_rate_found=bool(ind.get("interest_rate_found", False)),
        complaint_count=int(ind.get("complaint_count", 0) or 0),
    )


def _collect_fetch_urls(site: str | None, search: dict) -> list[str]:
    urls: list[str] = []
    if site:
        urls.append(site)
    for r in (search.get("results") or []):
        u = r.get("url")
        if u:
            urls.append(u)
    # de-duplicate, cap at 10
    seen = set()
    out = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= 10:
            break
    return out


def _build_report(name: str, site: str | None, demo: bool, search: dict, rbi: dict,
                  fetch: dict, browser: dict, research: dict, score: dict) -> dict[str, Any]:
    statuses = {
        "search": search.get("status", "completed" if search.get("ok") else "failed"),
        "agent": rbi.get("status", "completed" if rbi.get("checked") else "unavailable"),
        "fetch": fetch.get("status", "completed" if fetch.get("ok") else "failed"),
        "browser": browser.get("status", "completed" if browser.get("ok") else "failed"),
        "research": research.get("status", "completed" if research.get("ok") else "unavailable"),
        "monitor": "not_started",
    }
    verified = []
    if rbi.get("checked") and rbi.get("found"):
        verified.append("The RBI directory returned a matching application entry.")
    if fetch.get("ok"):
        verified.append(f"{len(fetch.get('results', []))} public page(s) were successfully inspected.")
    if browser.get("ok") and browser.get("screenshot_url"):
        verified.append("A visual screenshot was captured and saved as evidence.")
    limitations = list(score.get("unverified", []))
    if not rbi.get("checked"):
        limitations.append(rbi.get("failure_reason") or "RBI directory verification was unavailable.")
    if not fetch.get("ok"):
        limitations.append(fetch.get("error") or "Public website inspection was unavailable.")
    if research.get("status") != "completed":
        limitations.append(research.get("notice") or research.get("error") or "Research did not complete.")

    return {
        "app_name": name,
        "site": site or "",
        "demo": demo,
        "score": score,
        "search": search,
        "rbi": rbi,
        "fetch": fetch,
        "browser": browser,
        "research": research,
        "service_statuses": statuses,
        "verified_findings": verified,
        "unverified_findings": limitations,
        "limitations": limitations,
        "indicators": {
            "rbi_checked": bool(rbi.get("checked", False)),
            "rbi_found": bool(rbi.get("found", False)),
            "fetch_checked": bool(fetch and fetch.get("ok")),
            "grievance_found": bool(fetch.get("indicators", {}).get("grievance_found", False)),
            "lending_partner_found": bool(fetch.get("indicators", {}).get("lending_partner_found", False)),
            "address_found": bool(fetch.get("indicators", {}).get("address_found", False)),
            "interest_rate_found": bool(fetch.get("indicators", {}).get("interest_rate_found", False)),
            "terms_found": bool(fetch.get("indicators", {}).get("terms_found", False)),
            "privacy_found": bool(fetch.get("indicators", {}).get("privacy_found", False)),
            "complaint_count": int(fetch.get("indicators", {}).get("complaint_count", 0) or 0),
        },
        "disclaimer": DISCLAIMER,
        "evidence_provenance": {
            "rbi_directory": {
                "source": "TinyFish Agent using the RBI public directory",
                "status": rbi.get("status"),
                "checked": bool(rbi.get("checked")),
                "found": bool(rbi.get("found")),
                "evidence": rbi.get("evidence", ""),
            },
            "website_transparency": {
                "source": "TinyFish Fetch inspected website/search URLs",
                "lending_partner_found": bool(fetch.get("indicators", {}).get("lending_partner_found", False)),
                "evidence": fetch.get("indicators", {}).get("evidence_details", {}).get("lending_partner", {}),
            },
            "research": {
                "source": "TinyFish Research report and its citations",
                "citations": research.get("citations", []),
            },
        },
    }


# --------------------------------------------------------------------------- #
# SSE investigation pipeline
# --------------------------------------------------------------------------- #
async def investigate_stream(name: str, site: str | None) -> AsyncGenerator[str, None]:
    demo = is_demo_mode()
    # In demo mode the report always reflects the fictional sample app, never
    # the name the user typed, so fictional findings are never attached to a
    # real loan app brand.
    sample = _load_sample() if demo else None
    report_name = sample["app_name"] if demo and sample else name
    report_site = sample.get("site") if demo and sample else (site or "")

    yield _sse("start", {"app_name": report_name, "site": report_site, "demo": demo,
                         "message": "Investigation started."})

    if demo:
        yield _sse("search", {"status": "completed", "message": "Public evidence discovered (sample).",
                              "data": sample["search"], "demo": True})
        yield _sse("agent", {"status": "completed", "message": "SIMULATED RBI RESULT — SAMPLE DATA (sample check).",
                             "data": sample["rbi"], "demo": True})
        yield _sse("fetch", {"status": "completed", "message": "Public websites inspected (sample).",
                             "data": sample["fetch"], "demo": True})
        yield _sse("browser", {"status": "completed", "message": "Visual evidence captured (sample).",
                               "data": sample["browser"], "demo": True})
        yield _sse("research", {"status": "completed", "message": "Cited findings prepared (sample).",
                                "data": sample["research"], "demo": True})
        yield _sse("monitor", {"status": "not_started",
                               "message": "Monitor is not created until you click Monitor RBI directory.", "demo": True})
        yield _sse("scoring", {"status": "completed", "message": "Risk score computed (sample).",
                               "data": sample["score"], "demo": True})
        report = _build_report(report_name, report_site, True, sample["search"], sample["rbi"], sample["fetch"],
                               sample["browser"], sample["research"], sample["score"])
        yield _sse("final", {"status": "completed", "report": report, "demo": True})
        return

    # ---------------- LIVE MODE (DEMO_MODE=0) ----------------
    if not has_api_key():
        yield _sse("error", {"status": "failed",
                             "message": "Live mode is on but TINYFISH_API_KEY is not configured. Set the key in .env or switch to DEMO_MODE=1."})
        yield _sse("final", {"status": "failed", "report": {"app_name": name, "site": site or "", "demo": False,
                         "error": "API key not configured", "disclaimer": DISCLAIMER}})
        return

    async def isolated(coro: Any) -> Any:
        try:
            return await coro
        except asyncio.TimeoutError:
            return {"ok": False, "status": "timed_out", "error": "Service timed out"}
        except Exception as exc:
            return {"ok": False, "status": "failed", "error": f"{type(exc).__name__}: {exc}"}

    def service_message(service: str, result: dict[str, Any]) -> str:
        error = result.get("error") or result.get("failure_reason") or "Service unavailable"
        if service == "search":
            return (
                f"Public evidence discovered ({len(result.get('results', []))} sources found)."
                if result.get("ok") else f"Public evidence discovery failed: {error}"
            )
        if service == "agent":
            if result.get("checked"):
                return f"RBI directory check completed: {'Found in directory' if result.get('found') else 'Not listed in directory'}."
            if result.get("run_id"):
                return f"RBI directory check queued (run ID: {result['run_id']})."
            return f"RBI directory check {result.get('status', 'unavailable')}: {error}"
        if service == "research":
            if result.get("ok"):
                return f"Cited research report prepared ({len(result.get('citations', []))} citations)."
            if result.get("run_id"):
                return f"Research queued (run ID: {result['run_id']}); result will be retrieved asynchronously."
            return f"Research {result.get('status', 'unavailable')}: {error}"
        if service == "fetch":
            return (
                f"Public websites inspected ({len(result.get('results', []))} pages analyzed)."
                if result.get("ok") else f"Public website inspection failed: {error}"
            )
        return "Visual evidence captured." if result.get("ok") else f"Visual evidence capture failed: {error}"

    async def prepare_browser(result: Any, shot_url: str) -> dict[str, Any]:
        browser = result if isinstance(result, dict) else {
            "ok": False, "status": "failed", "error": "Browser task returned no result"
        }
        if browser.get("ok"):
            screenshot_url = browser.get("screenshot_url")
            screenshot_path = browser.get("screenshot_path")
            if not screenshot_url or not screenshot_path or not os.path.isfile(screenshot_path):
                browser = {
                    **browser, "ok": False, "status": "failed",
                    "screenshot_url": None,
                    "error": "Screenshot was not persisted as accessible evidence",
                }
            elif screenshot_url.startswith("/"):
                browser = {**browser, "screenshot_url": f"{PUBLIC_BACKEND_URL}{screenshot_url}"}
        return {
            key: value for key, value in browser.items()
            if key not in {"session_id", "cdp_url", "screenshot_path"}
        }

    # First wave: Search, Agent and Research are independent. If the user
    # supplied a site, Fetch and Browser can join this wave immediately.
    search_task = asyncio.create_task(isolated(search_loan_app(name, site=site)))
    agent_task = asyncio.create_task(isolated(check_rbi_directory(name)))
    research_task = asyncio.create_task(isolated(run_research(name, site)))
    tasks: dict[asyncio.Task[Any], str] = {
        search_task: "search", agent_task: "agent", research_task: "research"
    }
    yield _sse("search", {"status": "started", "message": f"Discovering public evidence for '{name}' across web indices..."})
    yield _sse("agent", {"status": "started", "message": "Investigating official RBI digital lending apps directory..."})
    yield _sse("research", {"status": "started", "message": "Preparing cited analytical findings..."})

    search: dict[str, Any] = {"ok": False, "status": "pending", "results": [], "error": None}
    rbi: dict[str, Any] = {"ok": False, "status": "pending", "checked": False, "found": False}
    research: dict[str, Any] = {"ok": False, "status": "pending", "report": None, "citations": []}
    fetch: dict[str, Any] = {"ok": False, "status": "pending", "results": [], "indicators": {}}
    browser: dict[str, Any] = {"ok": False, "status": "pending"}
    fetch_started = False

    async def launch_fetch_browser(effective_site: str | None, search_result: dict[str, Any]) -> list[str]:
        nonlocal fetch_started
        if fetch_started:
            return []
        fetch_started = True
        urls = _collect_fetch_urls(effective_site, search_result)
        shot_url = effective_site or (search_result.get("results") or [{}])[0].get("url", "")
        fetch_task = asyncio.create_task(isolated(fetch_pages(
            urls, purpose=f"Investigate the loan app {name} for risk indicators and regulatory disclosures"
        )))
        browser_task = asyncio.create_task(isolated(
            capture_screenshot(shot_url, name) if shot_url else asyncio.sleep(
                0, result={"ok": False, "status": "failed", "error": "No website URL available for visual evidence capture"}
            )
        ))
        tasks[fetch_task] = "fetch"
        tasks[browser_task] = "browser"
        return urls

    if site:
        await launch_fetch_browser(site, {"results": []})
        yield _sse("fetch", {"status": "started", "message": "Inspecting public websites and regulatory disclosures..."})
        yield _sse("browser", {"status": "started", "message": "Capturing visual evidence via remote browser session..."})

    # Process results independently. Search unlocks Fetch and Browser when no
    # official site was supplied, without waiting for Agent or Research.
    while tasks:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            service = tasks.pop(task)
            result = task.result()
            if not isinstance(result, dict):
                result = {"ok": False, "status": "failed", "error": "Service returned an invalid result"}
            if service == "search":
                search = result
                effective_site = site or search.get("identified_site")
                if not site:
                    await launch_fetch_browser(effective_site, search)
                    yield _sse("fetch", {"status": "started", "message": "Inspecting public websites and regulatory disclosures..."})
                    yield _sse("browser", {"status": "started", "message": "Capturing visual evidence via remote browser session..."})
            elif service == "agent":
                rbi = result
            elif service == "research":
                research = result
            elif service == "fetch":
                fetch = result
            elif service == "browser":
                browser = await prepare_browser(result, site or search.get("identified_site", ""))
            yield _sse(service, {
                "status": result.get("status", "completed" if result.get("ok") else "failed"),
                "message": service_message(service, result),
                "data": result,
            })
        if search.get("status") in {"completed", "failed", "unavailable"} and fetch_started:
            core_done = (
                search.get("status") in {"completed", "failed", "unavailable"}
                and fetch.get("status") not in {"pending"}
                and browser.get("status") not in {"pending"}
            )
            if core_done:
                # Agent/Research are queued operations; their real results are
                # retrieved by the existing polling endpoints and must not hold
                # up the preliminary report.
                for task in list(tasks):
                    if task.done():
                        tasks.pop(task)
                        service = "agent" if task is agent_task else "research"
                        result = task.result()
                        if isinstance(result, dict):
                            if service == "agent":
                                rbi = result
                            else:
                                research = result
                            yield _sse(service, {
                                "status": result.get("status", "pending"),
                                "message": service_message(service, result),
                                "data": result,
                            })
                break

    # Monitor remains an optional, user-triggered operation.
    yield _sse("monitor", {"status": "not_started",
                           "message": "Monitor is not created until you click Monitor RBI directory."})

    # SCORING — Evidence-Based Risk Engine
    indicators = _build_indicators(rbi, fetch)
    score = compute_score(indicators)
    yield _sse("scoring", {"status": "completed", "message": f"Risk score computed: {score['score']}/100 ({score['verdict']}).", "data": score})

    # FINAL — Assembled Intelligence Dossier
    report = _build_report(name, effective_site, False, search, rbi, fetch, browser, research, score)
    yield _sse("final", {"status": "completed", "report": report})


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@app.get("/")
async def index():
    return FileResponse(os.path.join(PROJECT_ROOT, "index.html"))


@app.get("/api/investigate")
async def investigate(name: str, site: str | None = None):
    if not name or not name.strip():
        return JSONResponse({"error": "A loan application name is required."}, status_code=400)
    name = name.strip()
    site = (site or "").strip() or None
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(
        investigate_stream(name, site),
        media_type="text/event-stream",
        headers=headers,
    )


@app.post("/api/watch")
async def watch(request: Request):
    """Create an RBI directory monitor on demand (Feature 6)."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    webhook_url = body.get("webhook_url")
    # If in demo mode, simulate.
    if is_demo_mode():
        return {"ok": True, "demo": True, "monitor_id": "demo-monitor-001", "status": "active",
                "message": "SIMULATED MONITOR — SAMPLE DATA. Monitoring the RBI directory (simulated)."}
    global _active_monitor
    async with _monitor_lock:
        if _active_monitor and _active_monitor.get("ok") and _active_monitor.get("monitor_id"):
            return _active_monitor
        result = await create_monitor(webhook_url=webhook_url)
        if result.get("ok") and result.get("monitor_id"):
            result["status"] = "active"
            _active_monitor = result
    return result


@app.get("/api/agent/status")
async def agent_status(run_id: str):
    if not run_id.strip():
        return JSONResponse({"error": "An agent run ID is required."}, status_code=400)
    return await get_rbi_directory_status(run_id)


@app.get("/api/research/status")
async def research_status(run_id: str):
    if not run_id.strip():
        return JSONResponse({"error": "A research run ID is required."}, status_code=400)
    return await get_research_status(run_id)


@app.post("/api/webhook")
async def webhook(request: Request):
    """Receive monitor notifications and persist them as alerts."""
    try:
        payload = await request.json()
    except Exception:
        payload = {"raw": await request.body()}
    alerts = _load_alerts()
    alerts.append({"payload": payload})
    _save_alerts(alerts)
    return {"ok": True, "received": True}


@app.get("/api/alerts")
async def alerts():
    return {"alerts": _load_alerts()}


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "demo_mode": is_demo_mode(),
        "api_key_configured": has_api_key(),
        "rbi_url": get_rbi_url(),
        "port": get_port(),
    }


# --------------------------------------------------------------------------- #
# Alert persistence (simple JSON file)
# --------------------------------------------------------------------------- #
def _load_alerts() -> list[dict[str, Any]]:
    if os.path.exists(ALERTS_FILE):
        try:
            with open(ALERTS_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _save_alerts(alerts: list[dict[str, Any]]) -> None:
    try:
        with open(ALERTS_FILE, "w", encoding="utf-8") as f:
            json.dump(alerts, f, indent=2, default=str)
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=get_port(), reload=False)
