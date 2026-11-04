"""TinyFish Browser integration (Feature 4) — visual evidence.

The Browser API has no SDK method, so we call the REST endpoint directly with
httpx: POST https://api.browser.tinyfish.ai -> {session_id, cdp_url, base_url}.
Then we connect with Playwright's connect_over_cdp(), navigate, screenshot, save
locally, and DELETE the session. Never pretends a screenshot was captured.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import httpx

from .config import BROWSER_API_URL, EVIDENCE_DIR, get_api_key, has_api_key

SCREENSHOT_TIMEOUT_S = float(os.getenv("BROWSER_SCREENSHOT_TIMEOUT_S", "90"))


async def capture_screenshot(url: str, app_name: str = "app") -> dict[str, Any]:
    """Capture a screenshot of `url` via a remote TinyFish browser session."""
    out: dict[str, Any] = {
        "ok": False,
        "status": "failed",
        "screenshot_url": None,
        "screenshot_path": None,
        "session_id": None,
        "cdp_url": None,
        "error": None,
    }
    if not has_api_key():
        out["error"] = "TINYFISH_API_KEY not configured"
        out["status"] = "unavailable"
        return out
    if not url:
        out["error"] = "No URL provided for screenshot"
        out["status"] = "failed"
        return out

    headers = {"X-API-Key": get_api_key(), "Content-Type": "application/json"}
    body = {"url": url, "timeout_seconds": 120}

    async with httpx.AsyncClient(timeout=60.0) as http:
        # 1) Create the remote browser session.
        try:
            resp = await http.post(BROWSER_API_URL, headers=headers, json=body)
        except Exception as exc:
            out["error"] = f"Browser session request failed: {type(exc).__name__}: {exc}"
            out["status"] = "failed"
            return out
        if resp.status_code != 201:
            out["error"] = f"Browser API returned {resp.status_code}: {resp.text[:300]}"
            out["status"] = "unavailable" if resp.status_code in (401, 402, 403, 404) else "failed"
            return out
        try:
            data = resp.json()
        except ValueError as exc:
            out["error"] = f"Browser API returned invalid JSON: {exc}"
            out["status"] = "failed"
            return out
        session_id = data.get("session_id")
        cdp_url = data.get("cdp_url")
        base_url = data.get("base_url")
        out["session_id"] = session_id
        out["cdp_url"] = cdp_url
        if not cdp_url:
            out["error"] = "Browser API returned no cdp_url"
            out["status"] = "failed"
            return out

        # 2) Connect with Playwright, screenshot, save, then terminate session.
        try:
            from playwright.async_api import async_playwright  # type: ignore

            async def _shoot() -> None:
                async with async_playwright() as p:
                    browser = await p.chromium.connect_over_cdp(cdp_url)
                    try:
                        context = browser.contexts[0] if browser.contexts else await browser.new_context()
                        page = context.pages[0] if context.pages else await context.new_page()
                        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                        await page.wait_for_timeout(1500)
                        os.makedirs(EVIDENCE_DIR, exist_ok=True)
                        safe = "".join(c if c.isalnum() else "_" for c in app_name)[:30]
                        fname = f"{safe}_{int(time.time())}.png"
                        path = os.path.join(EVIDENCE_DIR, fname)
                        await page.screenshot(path=path, full_page=False)
                        if not os.path.isfile(path):
                            raise RuntimeError("Screenshot capture returned without a saved evidence file")
                        out["screenshot_path"] = path
                        out["screenshot_url"] = f"/static/evidence/{fname}"
                        out["ok"] = True
                        out["status"] = "completed"
                    finally:
                        try:
                            await browser.close()
                        except Exception:
                            pass

            await asyncio.wait_for(_shoot(), timeout=SCREENSHOT_TIMEOUT_S)
        except asyncio.TimeoutError:
            out["status"] = "timed out"
            out["error"] = f"Screenshot timed out after {SCREENSHOT_TIMEOUT_S}s"
        except Exception as exc:
            out["status"] = "failed"
            out["error"] = f"Screenshot capture failed: {type(exc).__name__}: {exc}"
        finally:
            # Always attempt to terminate the session (DELETE is idempotent).
            if session_id:
                try:
                    await http.delete(f"{BROWSER_API_URL}/{session_id}", headers=headers)
                except Exception:
                    pass
    return out
