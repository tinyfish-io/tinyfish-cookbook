"""TinyFish Monitor integration (Feature 6) — on-demand RBI directory monitoring.

Uses AsyncTinyFish.monitors.create() to schedule a Page Monitor over the RBI
directory URL. Monitor is only created when the user explicitly clicks the
Monitor button (never automatically). Beta — may return 402/404; handled cleanly.
"""

from __future__ import annotations

from typing import Any

from .config import get_api_key, get_rbi_url, has_api_key


def _client():
    from tinyfish import AsyncTinyFish  # type: ignore

    return AsyncTinyFish(api_key=get_api_key(), timeout=60.0, max_retries=0)


async def create_monitor(webhook_url: str | None = None, schedule_cron: str = "0 9 * * *") -> dict[str, Any]:
    """Create a Page Monitor over the RBI directory URL. Never raises."""
    out: dict[str, Any] = {
        "ok": False,
        "monitor_id": None,
        "status": None,
        "message": None,
        "error": None,
    }
    if not has_api_key():
        out["error"] = "TINYFISH_API_KEY not configured"
        out["status"] = "unavailable"
        return out
    try:
        client = _client()
    except Exception as exc:  # pragma: no cover
        out["error"] = f"SDK init failed: {exc}"
        out["status"] = "unavailable"
        return out

    config = {"url": get_rbi_url(), "format": "markdown"}
    kwargs: dict[str, Any] = {"purpose": "Detect additions/changes to the RBI digital lending apps directory"}
    if webhook_url:
        kwargs["webhook_url"] = webhook_url

    try:
        created = await client.monitors.create("fetch", config, schedule_cron, **kwargs)
        monitor = getattr(created, "monitor", None)
        out["monitor_id"] = getattr(monitor, "id", None)
        out["status"] = str(getattr(monitor, "status", "ACTIVE")).split(".")[-1].lower()
        out["ok"] = bool(out["monitor_id"])
        out["message"] = f"Monitor created on RBI directory (ID: {out['monitor_id']})."
        if not out["ok"]:
            out["error"] = "TinyFish returned a monitor without an ID"
            out["status"] = "unavailable"
    except Exception as exc:
        name = type(exc).__name__
        msg = str(exc)
        out["error"] = f"{name}: {msg}"
        out["status"] = "unavailable"
        # 402 / 404 / beta-not-enabled signals
        low = (name + " " + msg).lower()
        if "404" in low or "not found" in low or "not enabled" in low or "beta" in low:
            out["message"] = "Monitoring unavailable — beta feature not enabled."
        elif "402" in low or "payment" in low or "insufficient" in low or "credit" in low:
            out["message"] = "Monitoring unavailable — insufficient credits for this beta feature."
        else:
            out["message"] = "Monitoring request failed."
    return out
