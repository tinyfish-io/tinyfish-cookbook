"""TinyFish Agent integration (Feature 2) — the core RBI directory check.

Uses AsyncTinyFish.agent.queue() with a structured output_schema to check the RBI
"Digital Lending Apps deployed by Regulated Entities" directory for a given app.

Key behaviour:
  * Starts at the RBI homepage and CLICKS the visible directory link (preserving
    the tokenized redirect) rather than navigating to a copied bare URL.
  * Returns normalized internal fields: checked, found, matched_name,
    lending_entity, evidence, failure_reason.
  * A failed lookup is NEVER reported as confirmed absence (checked=false keeps
    found=false). No retry loops.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

from .config import get_api_key, get_rbi_url, has_api_key

QUEUE_TIMEOUT_S = float(os.getenv("AGENT_QUEUE_TIMEOUT_S", "30"))


def _status_text(status: Any) -> str:
    return str(getattr(status, "value", status)).upper().split(".")[-1]

# Minimal schema — the API rejects description/title/nullable keywords.
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "checked": {"type": "boolean"},
        "found": {"type": "boolean"},
        "matched_name": {"type": "string"},
        "lending_entity": {"type": "string"},
        "evidence": {"type": "string"},
        "failure_reason": {"type": "string"},
    },
    "required": ["checked", "found", "matched_name", "lending_entity", "evidence", "failure_reason"],
}


def build_goal(app_name: str) -> str:
    return f"""You are on the Reserve Bank of India public website (rbi.org.in). Your ONLY task is to check the RBI's public list of Digital Lending Apps (DLAs) deployed by Regulated Entities for an application named "{app_name}".

NAVIGATION (follow exactly — the directory sits behind a tokenized redirect, so you MUST click the real link, not a copied URL):
1. Open https://www.rbi.org.in/ and wait for the homepage to finish loading.
2. Locate the visible link labelled "DLA’s deployed by Regulated Entities" (also accept the ASCII-apostrophe variant "DLA's deployed by Regulated Entities").
3. Scroll the link into view if necessary.
4. CLICK the actual visible link using the current browser session.
5. Do NOT copy the link's href and independently navigate to the bare URL — that drops the token and returns "Unauthorized Access". You must click the element itself.
6. Allow all redirects to complete fully.
7. Preserve cookies, session state and any query parameters / tokens in the URL throughout.
8. If a new tab or popup opens, switch to it and continue there.

ON THE DIRECTORY PAGE:
9. The directory may be a dynamic/interactive table, an embedded iframe, a Power BI / document viewer, or a paginated list. Inspect the resulting page and identify the directory table or search interface. Interact with it directly: use any search or filter field present, scroll, follow pagination / "view all" / expand controls, and switch tabs or pages as needed. Do NOT assume static HTML.

SEARCH:
10. Search for the application named "{app_name}". Use careful fuzzy matching to handle spacing/capitalization variants (e.g. "{app_name}", "{app_name.replace(' ', '')}", "{app_name.lower()}"). Avoid false positives on unrelated apps that merely share a word.
11. Extract the matched name and the regulated lending entity (NBFC/bank) ONLY when supported by actual directory evidence shown on the page.

REPORTING:
12. If a matching app is listed: set found=true with its exact listed name, the regulated lending entity, and a short verbatim quote of the evidence.
13. If you reached and could search the directory but "{app_name}" is not listed after a reasonable search: report found=false AND checked=true.
14. If you CANNOT reach or access the directory at all (e.g. "Unauthorized Access", page missing, blocked by captcha/login, content failed to load, navigation failed): report checked=false and put the actual error evidence in failure_reason. Do NOT report a failed lookup as a confirmed absence — found must be false when checked is false.

CONSTRAINTS:
- Do not hardcode or guess a generated token.
- Do not strip URL parameters.
- Do not retry repeatedly.
- Do not treat an unauthorized response as absence.

Return the result strictly as the structured JSON requested."""


def _normalize(agent_result: dict | None, status: Any, error: Any) -> dict[str, Any]:
    base = {
        "checked": False,
        "found": False,
        "matched_name": "",
        "lending_entity": "",
        "evidence": "",
        "failure_reason": "",
    }
    completed = _status_text(status) == "COMPLETED"
    if completed and isinstance(agent_result, dict):
        for k in base:
            if k in agent_result:
                base[k] = agent_result[k]
    if not completed:
        error_text = getattr(error, "message", error)
        base["failure_reason"] = f"Agent run did not complete (status={status})."
        if error_text:
            base["failure_reason"] += f" error={error_text}"
    # Guard: a failed check must never read as confirmed absence.
    if not base["checked"] and base["found"]:
        base["found"] = False
    return base


async def check_rbi_directory(name: str) -> dict[str, Any]:
    """Queue an RBI directory check and return its actual run ID."""
    out: dict[str, Any] = {
        "ok": False,
        "status": "failed",
        "checked": False,
        "found": False,
        "matched_name": "",
        "lending_entity": "",
        "evidence": "",
        "failure_reason": "",
        "error": None,
        "raw_status": None,
        "num_of_steps": None,
        "run_id": None,
    }
    if not has_api_key():
        out["error"] = "TINYFISH_API_KEY not configured"
        out["failure_reason"] = "API key not configured"
        out["status"] = "unavailable"
        return out
    try:
        from tinyfish import AsyncTinyFish  # type: ignore

        client = AsyncTinyFish(api_key=get_api_key(), timeout=60.0, max_retries=0)
    except Exception as exc:  # pragma: no cover
        out["error"] = f"SDK init failed: {exc}"
        out["failure_reason"] = str(exc)
        out["status"] = "failed"
        return out

    try:
        response = await asyncio.wait_for(
            client.agent.queue(goal=build_goal(name), url=get_rbi_url(), output_schema=OUTPUT_SCHEMA),
            timeout=QUEUE_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        out["error"] = f"Agent queue timed out after {QUEUE_TIMEOUT_S}s"
        out["failure_reason"] = "RBI directory verification could not be completed. This does not indicate that the app is absent from the directory."
        out["status"] = "timed_out"
        return out
    except Exception as exc:
        out["error"] = f"{type(exc).__name__}: {exc}"
        out["failure_reason"] = out["error"]
        out["status"] = "failed"
        return out

    out["run_id"] = getattr(response, "run_id", None)
    error = getattr(response, "error", None)
    if not out["run_id"]:
        out["error"] = getattr(error, "message", error) or "Agent queue returned no run ID"
        out["failure_reason"] = str(out["error"])
        out["status"] = "unavailable"
        return out
    out["raw_status"] = "PENDING"
    out["status"] = "queued"
    out["message"] = f"RBI directory check queued (run ID: {out['run_id']})."
    return out


async def get_rbi_directory_status(run_id: str) -> dict[str, Any]:
    """Retrieve and normalize one queued RBI directory run."""
    out: dict[str, Any] = {
        "ok": False, "status": "unavailable", "checked": False, "found": False,
        "matched_name": "", "lending_entity": "", "evidence": "",
        "failure_reason": "", "error": None, "raw_status": None, "run_id": run_id,
    }
    if not has_api_key():
        out["error"] = "TINYFISH_API_KEY not configured"
        out["failure_reason"] = out["error"]
        return out
    try:
        from tinyfish import AsyncTinyFish  # type: ignore
        client = AsyncTinyFish(api_key=get_api_key(), timeout=60.0, max_retries=0)
        response = await client.runs.get(run_id)
    except Exception as exc:
        out["error"] = f"{type(exc).__name__}: {exc}"
        out["failure_reason"] = out["error"]
        return out

    raw_status = _status_text(getattr(response, "status", "UNAVAILABLE"))
    out["raw_status"] = raw_status
    out["provider_status"] = raw_status
    error = getattr(response, "error", None)
    error_text = getattr(error, "message", error)
    if raw_status == "COMPLETED":
        result = getattr(response, "result", None)
        if isinstance(result, dict):
            out.update(_normalize(result, raw_status, error))
            out["ok"] = bool(out["checked"])
            out["status"] = "completed"
        else:
            out["status"] = "unavailable"
            out["error"] = error_text or "Agent completed without a structured result"
            out["failure_reason"] = str(out["error"])
    elif raw_status in {"PENDING", "RUNNING"}:
        out["status"] = "queued" if raw_status == "PENDING" else "running"
    elif raw_status in {"TIMED_OUT", "TIMEOUT"} or getattr(error, "code", "") in {"TIMEOUT", "TIMED_OUT"}:
        out["status"] = "timed_out"
        out["error"] = error_text or "Agent run timed out"
        out["failure_reason"] = "RBI directory verification could not be completed. This does not indicate that the app is absent from the directory."
    else:
        out["status"] = "failed"
        out["error"] = error_text or f"Agent run ended with status {raw_status}"
        out["failure_reason"] = str(out["error"])
    return out
