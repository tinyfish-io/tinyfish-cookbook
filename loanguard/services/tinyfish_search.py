"""TinyFish Search integration (Feature 1).

Discovers public information about a loan application using
AsyncTinyFish.search.query(). Defensive parsing only against documented fields
(.query, .total_results, .results[] with .title/.url/.snippet/.description).
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from .config import get_api_key, has_api_key

EXCLUDED_THIRD_PARTY_DOMAINS = {
    "play.google.com",
    "apps.apple.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "youtube.com",
    "instagram.com",
    "consumercomplaints.in",
    "mouthshut.com",
    "wikipedia.org",
    "rbi.org.in",
    "economictimes.indiatimes.com",
    "moneycontrol.com",
    "livemint.com",
    "ndtv.com",
    "thehindu.com",
    "financialexpress.com",
    "timesofindia.indiatimes.com",
}


def _client():
    from tinyfish import AsyncTinyFish  # type: ignore

    return AsyncTinyFish(api_key=get_api_key(), timeout=20.0, max_retries=0)


def default_queries(name: str, site: str | None = None) -> list[str]:
    # Cost-controlled focused queries covering:
    # 1. Official website & operator
    # 2. Named lending partner (NBFC/Bank)
    # 3. Public complaints & harassment
    # 4. RBI regulatory directory
    site_hint = f' "{site}"' if site else ""
    return [
        f"{name} loan app{site_hint} official website operator NBFC lending partner",
        f"{name} loan app consumer complaints harassment recovery agent scam",
        f"{name} RBI digital lending apps directory regulated entities",
    ]


def _parse_result(item: Any) -> dict[str, Any]:
    return {
        "title": getattr(item, "title", None),
        "url": getattr(item, "url", None),
        "snippet": getattr(item, "snippet", None),
        "description": getattr(item, "description", None),
    }


def identify_official_website(name: str, results: list[dict[str, Any]]) -> str | None:
    """Identify candidate official website domain from search evidence without assuming the first result."""
    clean_name = re.sub(r"[^a-zA-Z0-9]", "", name.lower())
    if not clean_name:
        return None

    candidates: list[str] = []
    for r in results:
        u = r.get("url") or ""
        try:
            parsed = urlparse(u)
            domain = (parsed.netloc or "").lower()
            if domain.startswith("www."):
                domain = domain[4:]
            if not domain or domain in EXCLUDED_THIRD_PARTY_DOMAINS:
                continue
            # If the app name is a substantial part of the domain name
            domain_name = domain.split(".")[0]
            if clean_name in domain_name or domain_name in clean_name:
                # Root or clean homepage URL
                base_url = f"{parsed.scheme or 'https'}://{parsed.netloc}"
                if base_url not in candidates:
                    candidates.append(base_url)
        except Exception:
            continue

    return candidates[0] if candidates else None


async def search_loan_app(
    name: str, site: str | None = None, queries: list[str] | None = None
) -> dict[str, Any]:
    """Run discovery searches. Never raises — returns a status dict."""
    out: dict[str, Any] = {
        "ok": False,
        "status": "unavailable",
        "queries": [],
        "results": [],
        "sources": [],
        "identified_site": None,
        "error": None,
    }
    if not has_api_key():
        out["error"] = "TINYFISH_API_KEY not configured"
        return out
    try:
        client = _client()
    except Exception as exc:  # pragma: no cover
        out["error"] = f"SDK init failed: {exc}"
        return out

    qs = queries or default_queries(name, site)
    seen_urls: set[str] = set()

    for q in qs:
        entry: dict[str, Any] = {"query": q, "total": None, "results": [], "error": None}
        try:
            resp = await client.search.query(q)
            results = [_parse_result(r) for r in (getattr(resp, "results", None) or [])]
            entry["total"] = getattr(resp, "total_results", None)
            entry["results"] = results
            for r in results:
                u = r.get("url")
                if u and u not in seen_urls:
                    seen_urls.add(u)
                    out["results"].append(r)
                    out["sources"].append(u)
        except Exception as exc:
            entry["error"] = f"{type(exc).__name__}: {exc}"
            out["error"] = entry["error"]
        out["queries"].append(entry)

    # Detect possible official website from public evidence
    out["identified_site"] = identify_official_website(name, out["results"])

    # ok if at least one query returned results without error
    out["ok"] = any(qe["results"] for qe in out["queries"])
    out["status"] = "completed" if out["ok"] else "failed"
    if not out["ok"] and out["error"] is None:
        out["error"] = "No search results returned"
    return out
