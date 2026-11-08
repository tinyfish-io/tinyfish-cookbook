#!/usr/bin/env python3
"""Find and rank live public ATS jobs using TinyFish Search + Fetch only.

Python 3.10+, standard library. Page content is data, never instructions.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import html
import ipaddress
import json
import os
from pathlib import Path
import re
import sys
import time
from dataclasses import dataclass, asdict
from html.parser import HTMLParser
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

SEARCH_URL = "https://api.search.tinyfish.ai"
FETCH_URL = "https://api.fetch.tinyfish.ai"
MAX_RESPONSE_BYTES = 24 * 1024 * 1024
TRACKING_PARAMS = {"source", "ref", "referrer", "gh_src", "lever-source", "lever-origin"}
PROVIDERS = ("greenhouse", "lever", "ashby")
SEARCH_DOMAINS = {
    "greenhouse": "(site:job-boards.greenhouse.io OR site:boards.greenhouse.io)",
    "lever": "(site:jobs.lever.co OR site:jobs.eu.lever.co)",
    "ashby": "site:jobs.ashbyhq.com",
}


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clean_text(value):
    return re.sub(r"\s+", " ", value).strip() if isinstance(value, str) else ""


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        elif tag in ("p", "br", "div", "li", "h1", "h2", "h3"):
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.hidden:
            self.hidden -= 1
        elif tag in ("p", "div", "li", "h1", "h2", "h3"):
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def plain_text(value):
    parser = PlainText()
    parser.feed(html.unescape(value) if isinstance(value, str) else "")
    return clean_text("".join(parser.parts))


def safe_url(value):
    """Allow public HTTPS links; never userinfo, IP tricks, or local destinations."""
    if not isinstance(value, str) or len(value) > 4096 or re.search(r"[\x00-\x20\\]", value):
        return None
    try:
        p = urlsplit(value)
        host = (p.hostname or "").lower().rstrip(".")
        if p.scheme != "https" or p.username or p.password or p.port not in (None, 443):
            return None
        if not host or "." not in host or host.endswith((".localhost", ".local", ".internal")):
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            if not re.fullmatch(r"[a-z0-9.-]+", host) or host.startswith(".") or ".." in host:
                return None
            # Reject alternate numeric-address spellings as well as normal private IPs.
            if all(re.fullmatch(r"(?:[0-9]+|0x[0-9a-f]+)", label) for label in host.split(".")):
                return None
        return urlunsplit(("https", host, p.path or "/", p.query, ""))
    except ValueError:
        return None


def canonical_url(value):
    value = safe_url(value)
    if not value:
        return None
    p = urlsplit(value)
    query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in TRACKING_PARAMS]
    path = p.path.rstrip("/") or "/"
    if p.hostname in ("jobs.lever.co", "jobs.eu.lever.co") and path.endswith("/apply"):
        path = path[:-6]
    host = "job-boards.greenhouse.io" if p.hostname == "boards.greenhouse.io" else p.hostname
    return urlunsplit(("https", host, path, urlencode(sorted(query)), ""))


@dataclass(frozen=True)
class Board:
    provider: str
    slug: str
    region: str = "global"
    posting_id: str | None = None

    @property
    def key(self):
        return f"{self.provider}:{self.region}:{self.slug}"

    @property
    def url(self):
        hosts = {"greenhouse": "job-boards.greenhouse.io", "ashby": "jobs.ashbyhq.com",
                 "lever": "jobs.eu.lever.co" if self.region == "eu" else "jobs.lever.co"}
        return f"https://{hosts[self.provider]}/{quote(self.slug)}"

    @property
    def feed_url(self):
        slug = quote(self.slug, safe="")
        if self.provider == "greenhouse" and self.posting_id:
            return f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{self.posting_id}"
        if self.provider == "greenhouse":
            return f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
        if self.provider == "lever":
            host = "api.eu.lever.co" if self.region == "eu" else "api.lever.co"
            if self.posting_id:
                return f"https://{host}/v0/postings/{slug}/{self.posting_id}?mode=json"
            return f"https://{host}/v0/postings/{slug}?mode=json&limit=100&skip=0"
        return f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true"


def board_from_url(value):
    value = safe_url(value)
    if not value:
        return None
    p = urlsplit(value)
    providers = {"job-boards.greenhouse.io": "greenhouse", "boards.greenhouse.io": "greenhouse",
                 "jobs.lever.co": "lever", "jobs.eu.lever.co": "lever", "jobs.ashbyhq.com": "ashby"}
    provider = providers.get(p.hostname)
    parts = p.path.strip("/").split("/")
    if not provider or not parts or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", parts[0]):
        return None
    if parts[0].lower() in {"embed", "search", "jobs", "job", "login", "api"}:
        return None
    return Board(provider, parts[0], "eu" if p.hostname == "jobs.eu.lever.co" else "global")


class APIError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the API key to a redirect target.
        return None


class TinyFishClient:
    mode = "live"

    def __init__(self, key, timeout=150, retries=2, opener=None, sleep=time.sleep):
        if not key or not key.strip():
            raise APIError("Set TINYFISH_API_KEY in the environment before running a live search.")
        self.key, self.timeout, self.retries = key, timeout, retries
        self.opener = opener or build_opener(NoRedirect())
        self.sleep = sleep
        self.calls = []
        self.blocked = False

    def request(self, kind, payload):
        if self.blocked:
            raise APIError("TinyFish access stopped after an authentication, allowance, or permission error.")
        endpoint = SEARCH_URL if kind == "search" else FETCH_URL
        url = endpoint + "?" + urlencode(payload) if kind == "search" else endpoint
        data = None if kind == "search" else json.dumps(payload).encode("utf-8")
        request = Request(url, data=data, headers={"X-API-Key": self.key,
                          "Content-Type": "application/json", "Accept": "application/json",
                          "User-Agent": "careers-scout/1.0"})
        for attempt in range(self.retries + 1):
            record = {"endpoint": endpoint, "operation": kind, "requested_at": utc_now(),
                      "attempt": attempt + 1, "request": payload}
            self.calls.append(record)
            try:
                with self.opener.open(request, timeout=self.timeout) as response:
                    raw = response.read(MAX_RESPONSE_BYTES + 1)
                    record["http_status"] = response.status
                    record["response_sha256"] = hashlib.sha256(raw).hexdigest()
                    record["response_bytes"] = len(raw)
                if len(raw) > MAX_RESPONSE_BYTES:
                    raise APIError("TinyFish response exceeded the 24 MiB safety limit; reduce --max-boards.")
                body = json.loads(raw)
                if not isinstance(body, dict) or not isinstance(body.get("results"), list):
                    raise APIError("TinyFish returned an unexpected response schema.")
                return body
            except HTTPError as exc:
                record["http_status"] = exc.code
                if exc.code in (401, 402, 403):
                    self.blocked = True
                if exc.code in (429, 500, 502, 503, 504) and attempt < self.retries:
                    self.sleep(15 * (2 ** attempt))
                    continue
                advice = {401: "check the API key", 402: "daily allowance or wallet exhausted; stop",
                          403: "access denied; stop", 429: "rate limited; retry later"}.get(exc.code, "request failed")
                raise APIError(f"TinyFish {kind} HTTP {exc.code}: {advice}.") from None
            except (URLError, TimeoutError, OSError, HTTPException):
                record["error"] = "network_error"
                if attempt < self.retries:
                    self.sleep(2 ** attempt)
                    continue
                raise APIError(f"TinyFish {kind} network timeout or connection failure.") from None
            except (UnicodeDecodeError, json.JSONDecodeError):
                record["error"] = "invalid_json"
                raise APIError(f"TinyFish {kind} returned invalid JSON.") from None

    def search(self, query, country, language):
        return self.request("search", {"query": query, "location": country, "language": language})

    def fetch(self, urls):
        if not 1 <= len(urls) <= 10:
            raise ValueError("Fetch requires 1–10 URLs.")
        return self.request("fetch", {"urls": urls, "format": "markdown", "ttl": 0,
                            "per_url_timeout_ms": 45000})


class FixtureClient:
    mode = "fixture"

    def __init__(self, path):
        self.data = json.loads(Path(path).read_text(encoding="utf-8"))
        if not isinstance(self.data, dict) or self.data.get("synthetic_fixture") is not True:
            raise APIError("Fixture file must explicitly declare synthetic_fixture: true.")
        self.calls = []

    def search(self, query, country, language):
        self.calls.append({"operation": "search", "fixture": True, "query": query})
        if not isinstance(self.data.get("search", {}), dict):
            raise APIError("Fixture search field must be an object.")
        provider = next(p for p in PROVIDERS if p in query or (p == "ashby" and "ashbyhq" in query))
        return {"results": self.data.get("search", {}).get(provider, [])}

    def fetch(self, urls):
        self.calls.append({"operation": "fetch", "fixture": True, "urls": urls})
        results, errors = [], []
        if not isinstance(self.data.get("feeds", {}), dict):
            raise APIError("Fixture feeds field must be an object.")
        for url in urls:
            if url in self.data.get("feeds", {}):
                results.append({"url": url, "final_url": url,
                                "text": json.dumps(self.data["feeds"][url])})
            else:
                errors.append({"url": url, "error": "page_not_found"})
        return {"results": results, "errors": errors}


def audit_request(request):
    """Keep only non-credential request fields; never copy imported headers."""
    if not isinstance(request, dict):
        return None
    allowed = {}
    for key in ("query", "location", "country", "language", "format"):
        if isinstance(request.get(key), str):
            allowed[key] = request[key]
    for key in ("ttl", "per_url_timeout_ms"):
        if type(request.get(key)) in (int, float):
            allowed[key] = request[key]
    if isinstance(request.get("urls"), list):
        allowed["urls"] = [safe_url(url) for url in request["urls"] if safe_url(url)]
    return allowed


class CaptureClient:
    """Replay real TinyFish tool/playground responses; never impersonate REST execution."""

    def __init__(self, path):
        self.data = json.loads(Path(path).read_text(encoding="utf-8"))
        if not isinstance(self.data, dict):
            raise APIError("Capture must be a JSON object.")
        if any(not isinstance(self.data.get(k, []), list) for k in ("search", "fetch")):
            raise APIError("Capture search and fetch fields must be arrays.")
        transport = self.data.get("transport")
        if transport not in ("tinyfish-mcp", "tinyfish-playground"):
            raise APIError("Capture transport must be tinyfish-mcp or tinyfish-playground.")
        self.mode = "mcp_capture" if transport == "tinyfish-mcp" else "playground_capture"
        self.calls = []
        self.transport = transport

    def entry(self, kind, predicate):
        for entry in self.data.get(kind, []):
            if not isinstance(entry, dict) or not predicate(entry):
                continue
            captured = entry.get("captured_at")
            try:
                timestamp = dt.datetime.fromisoformat(captured.replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    raise ValueError()
            except (AttributeError, TypeError, ValueError):
                raise APIError("Every capture entry needs a timezone-aware captured_at timestamp.") from None
            response = entry.get("response")
            if not isinstance(response, dict) or not isinstance(response.get("results"), list):
                raise APIError("Capture response must preserve TinyFish's results array.")
            self.calls.append({"operation": kind, "transport": self.transport, "captured_at": captured,
                               "source": clean_text(entry.get("source")) or "user-supplied capture",
                               "response_sha256": hashlib.sha256(json.dumps(response, sort_keys=True).encode()).hexdigest(),
                               "query": entry.get("query"), "urls": entry.get("urls"),
                               "request": audit_request(entry.get("request"))})
            return response, captured
        raise APIError(f"No matching {kind} response in the capture; execute the emitted request first.")

    def search(self, query, country, language):
        def matches(entry):
            if entry.get("query") != query:
                return False
            request = entry.get("request")
            if isinstance(request, dict):
                for key, expected in (("location", country), ("country", country), ("language", language)):
                    if request.get(key) is not None and request[key] != expected:
                        raise APIError("Captured Search localization does not match the requested preferences.")
            return True
        response, _ = self.entry("search", matches)
        return response

    def fetch(self, urls):
        results, errors = [], []
        covered = set()
        for entry in self.data.get("fetch", []):
            requested = entry.get("urls", []) if isinstance(entry, dict) else []
            if not isinstance(requested, list) or any(not isinstance(u, str) for u in requested):
                raise APIError("Captured Fetch urls must be an array of strings.")
            if not set(requested).intersection(urls):
                continue
            response, captured = self.entry("fetch", lambda e: e is entry)
            request = entry.get("request")
            request = request if isinstance(request, dict) else {}
            # Pages outside the selected plan cannot enter the result set.
            for page in response.get("results", []):
                if isinstance(page, dict) and page.get("url") in urls:
                    results.append(dict(page, _captured_at=captured, _capture_ttl=request.get("ttl")))
                    covered.add(page["url"])
            for error in response.get("errors") or []:
                if isinstance(error, dict) and error.get("url") in urls:
                    errors.append(error)
                    covered.add(error["url"])
        issues = self.data.get("capture_issues", [])
        issues = issues if isinstance(issues, list) else []
        by_url = {issue.get("url"): issue for issue in issues if isinstance(issue, dict) and isinstance(issue.get("url"), str)}
        for url in urls:
            if url not in covered:
                issue = by_url.get(url)
                errors.append({"url": url, "error": clean_text(issue.get("error")) if issue else "missing_capture"})
                if issue:
                    self.calls.append({"operation": "capture_issue", "transport": self.transport,
                                       "url": url, "captured_at": issue.get("captured_at"),
                                       "source": issue.get("source"), "error": clean_text(issue.get("error"))})
        return {"results": results, "errors": errors}


@dataclass
class Preferences:
    roles: list[str]
    location: str = ""
    keywords: list[str] | None = None
    exclude: list[str] | None = None
    remote: str = "any"
    require_keywords: bool = False
    country: str = "US"
    language: str = "en"
    providers: list[str] | None = None


def contains(text, term):
    return bool(re.search(r"(?<!\w)" + re.escape(term.casefold()) + r"(?!\w)", text.casefold()))


def role_matches(title, role):
    tokens = re.findall(r"[\w+#]+", role.casefold())
    return bool(tokens) and all(contains(title, token) for token in tokens)


def string_list(values):
    return list(dict.fromkeys(clean_text(v) for v in values if clean_text(v)))


def parse_payload(text):
    # Some Fetch deployments render JSON origins as a document or escape Markdown.
    # Recover only lossless textual JSON; never extract partial records from truncation.
    if isinstance(text, dict) and text.get("type") == "document":
        def node_text(node):
            if not isinstance(node, dict):
                return ""
            own = node.get("text")
            if isinstance(own, str):
                return own
            children = node.get("children", [])
            return "\n".join(node_text(child) for child in children) if isinstance(children, list) else ""
        text = node_text(text)
    if isinstance(text, (dict, list)):
        return text
    if not isinstance(text, str):
        raise ValueError("missing content")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # JSON permits even backslash runs before these characters; preserve them.
        # An odd run is invalid JSON and can be a Markdown-only escape.
        repaired = re.sub(r"\\+[_*`\[\]<>#~]", lambda m: m.group()[1:] if (len(m.group()) - 1) % 2 else m.group(), text)
        return json.loads(repaired)


def expired(deadline, observed_at):
    if not isinstance(deadline, str) or not deadline:
        return False
    try:
        parsed = dt.datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        if len(deadline) == 10:
            parsed = parsed.replace(hour=23, minute=59, second=59)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        observed = dt.datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
        return parsed < observed
    except (ValueError, TypeError):
        return False


def extract_jobs(board, payload, observed_at):
    """Parse only documented fields. Unknown fields remain null; never infer from prose."""
    if isinstance(payload, dict) and board.posting_id and "id" in payload:
        rows = [payload]
    else:
        rows = payload if board.provider == "lever" else payload.get("jobs") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise ValueError("expected a public job list")
    jobs, rejected = [], collections.Counter()
    for row in rows:
        if not isinstance(row, dict):
            rejected["malformed_record"] += 1
            continue
        if row.get("isListed") is False:
            rejected["unlisted"] += 1
            continue
        deadline = row.get("application_deadline") or row.get("validThrough")
        if expired(deadline, observed_at):
            rejected["expired_deadline"] += 1
            continue
        provider = board.provider
        if provider == "greenhouse":
            title, link = row.get("title"), row.get("absolute_url")
            loc = row.get("location") or {}
            locations = string_list([loc.get("name")]) if isinstance(loc, dict) else []
            description = plain_text(row.get("content", ""))
            mode, employment, posted = None, None, row.get("first_published")
            updated = row.get("updated_at")
            salary = None
        elif provider == "lever":
            categories = row.get("categories") or {}
            if not isinstance(categories, dict):
                categories = {}
            title, link = row.get("text"), row.get("applyUrl") or row.get("hostedUrl")
            more_locations = categories.get("allLocations")
            locations = string_list([categories.get("location")] + (more_locations if isinstance(more_locations, list) else []))
            sections = row.get("lists") if isinstance(row.get("lists"), list) else []
            description = plain_text(" ".join(str(v or "") for v in [row.get("descriptionPlain") or row.get("description"),
                row.get("additionalPlain") or row.get("additional"),
                *(clean_text(s.get("text")) + " " + clean_text(s.get("content")) for s in sections if isinstance(s, dict))]))
            mode = row.get("workplaceType")
            employment, posted, updated = categories.get("commitment"), None, None
            salary = row.get("salaryRange") if isinstance(row.get("salaryRange"), dict) else None
        else:
            title, link = row.get("title"), row.get("applyUrl") or row.get("jobUrl")
            secondary = row.get("secondaryLocations")
            secondary = secondary if isinstance(secondary, list) else []
            locations = string_list([row.get("location")] + [v.get("location") if isinstance(v, dict) else v for v in secondary])
            address = row.get("address") or {}
            postal = address.get("postalAddress", {}) if isinstance(address, dict) else {}
            if isinstance(postal, dict):
                locations = string_list(locations + [postal.get("addressCountry"), postal.get("addressRegion"), postal.get("addressLocality")])
            description = plain_text(row.get("descriptionPlain") or row.get("descriptionHtml", ""))
            mode = row.get("workplaceType") or ("remote" if row.get("isRemote") is True else None)
            employment, posted, updated = row.get("employmentType"), row.get("publishedAt"), None
            salary = row.get("compensation") if isinstance(row.get("compensation"), dict) else None
        title, link = clean_text(title), safe_url(link)
        if not title or not link:
            rejected["missing_title_or_safe_apply_url"] += 1
            continue
        mode = clean_text(mode).lower()
        if mode not in ("remote", "hybrid", "onsite", "on-site"):
            location_text = " ".join(locations)
            negated_remote = bool(re.search(r"(?:not|no|non)[\s-]+(?:a\s+)?remote|remote[\s-]+(?:not|unavailable|ineligible)|remote\s*:\s*(?:no|false)", location_text, re.I))
            negated_hybrid = bool(re.search(r"(?:not|no|non)[\s-]+hybrid", location_text, re.I))
            mode = "hybrid" if contains(location_text, "hybrid") and not negated_hybrid else "remote" if contains(location_text, "remote") and not negated_remote else None
        if provider == "ashby" and row.get("isRemote") is False and mode == "remote":
            mode = None
        if mode == "on-site":
            mode = "onsite"
        jobs.append({"id": str(row["id"]) if isinstance(row.get("id"), (str, int)) and not isinstance(row.get("id"), bool) else "", "title": title,
                     "company": clean_text(row.get("company_name")) or None,
                     "employer_board": board.slug, "provider": provider, "locations": locations,
                     "work_mode": mode, "employment_type": clean_text(employment) or None,
                     "salary": salary, "application_deadline": deadline if isinstance(deadline, str) else None,
                     "posted_at": posted if isinstance(posted, str) else None,
                     "updated_at": updated if isinstance(updated, str) else None,
                     "apply_url": link, "canonical_job_url": canonical_url(row.get("hostedUrl") or row.get("jobUrl")) or canonical_url(link),
                     "source_board_url": board.url, "source_feed_url": board.feed_url,
                     "observed_at": observed_at, "availability": "listed_on_public_board",
                     "_description": description, "_board_key": board.key})
    return jobs, rejected


def rank_job(job, preferences):
    matched_roles = [r for r in preferences.roles if role_matches(job["title"], r)]
    if not matched_roles:
        return None, "role_mismatch"
    location_text = " | ".join(job["locations"])
    if preferences.location and not contains(location_text, preferences.location):
        return None, "location_missing_or_mismatch"
    if preferences.remote == "only" and job["work_mode"] != "remote":
        return None, "remote_not_confirmed"
    if preferences.remote == "exclude" and job["work_mode"] not in ("onsite", "hybrid"):
        return None, "onsite_or_hybrid_not_confirmed"
    body = job["title"] + " " + job["_description"]
    if any(contains(body, term) for term in preferences.exclude or []):
        return None, "excluded_keyword"
    matched_keywords = [k for k in preferences.keywords or [] if contains(body, k)]
    if preferences.require_keywords and len(matched_keywords) != len(preferences.keywords or []):
        return None, "required_keyword_missing"
    reasons = ["Title matches: " + ", ".join(matched_roles)]
    score = 50
    if any(contains(job["title"], role) for role in matched_roles):
        score += 15
        reasons.append("Exact role phrase in title")
    if preferences.location:
        score += 15
        reasons.append("Listed location matches: " + preferences.location)
    if preferences.remote != "any":
        score += 10
        reasons.append("Work mode confirmed: " + job["work_mode"])
    score += min(24, len(matched_keywords) * 8)
    if matched_keywords:
        reasons.append("Keywords found: " + ", ".join(matched_keywords))
    evidence = []
    for keyword in matched_keywords:
        match = re.search(r"(?<!\w)" + re.escape(keyword) + r"(?!\w)", body, re.IGNORECASE)
        if match:
            evidence.append({"keyword": keyword, "excerpt": body[max(0, match.start()-65):match.end()+105]})
    result = {k: v for k, v in job.items() if not k.startswith("_")}
    result.update(score=min(100, score), match_reasons=reasons, keyword_evidence=evidence,
                  description_excerpt=job["_description"][:320],
                  caveats=["Employer board identifier is preserved; missing company names are not inferred.",
                           "Listed when fetched; availability and eligibility can change."])
    if job["work_mode"] == "remote":
        result["caveats"].append("Remote does not mean worldwide; check the posting's country and work-authorization restrictions.")
    return result, None


def query_for(provider, preferences):
    roles = " OR ".join('"' + r.replace('"', ' ') + '"' for r in preferences.roles)
    terms = [f"({roles})", preferences.location, *(preferences.keywords or [])[:2], SEARCH_DOMAINS[provider]]
    return " ".join(clean_text(t) for t in terms if clean_text(t))


def find_jobs(preferences, client, explicit_boards=(), max_boards=6, limit=20, now=None, prepare_only=False):
    observed_at = now or utc_now()
    errors, discoveries, groups = [], [], []
    explicit = []
    for url in explicit_boards:
        board = board_from_url(url)
        if not board:
            raise ValueError("--board must be a supported public Greenhouse, Lever, or Ashby board URL.")
        explicit.append(board)
    for provider in preferences.providers or PROVIDERS:
        query = query_for(provider, preferences)
        boards = []
        try:
            response = client.search(query, preferences.country, preferences.language)
            search_rows = sorted(response["results"], key=lambda row: not (isinstance(row, dict) and any(role_matches(clean_text(row.get("title")), role) for role in preferences.roles)))
            for row in search_rows:
                if isinstance(row, dict):
                    board = board_from_url(row.get("url"))
                    if board and board.provider == provider:
                        path = urlsplit(row["url"]).path.rstrip("/")
                        target = re.fullmatch(r"/[^/]+/jobs/([0-9]+)", path) if provider == "greenhouse" else re.fullmatch(r"/[^/]+/([0-9a-fA-F-]{36})(?:/apply)?", path) if provider == "lever" else None
                        if target:
                            board = Board(board.provider, board.slug, board.region, target.group(1))
                        boards.append(board)
                        discoveries.append({"query": query, "board": board.key, "result_url": safe_url(row["url"])})
        except APIError as exc:
            errors.append({"stage": "search", "provider": provider, "error": str(exc)})
        groups.append(boards)
    # Round-robin across ATS providers so a busy first results page cannot monopolize the budget.
    selected, seen = [], set()
    candidates = list(explicit)
    for n in range(max((len(group) for group in groups), default=0)):
        candidates.extend(group[n] for group in groups if n < len(group))
    for board in candidates:
        if board.key not in seen and len(selected) < max_boards:
            selected.append(board)
            seen.add(board.key)
    if prepare_only:
        return {"transport": client.mode, "preferences": asdict(preferences),
                "fetch_request": {"urls": [b.feed_url for b in selected], "format": "markdown", "ttl": 0},
                "boards": [{"key": b.key, "url": b.url} for b in selected], "errors": errors}
    fetched, jobs, rejected = [], [], collections.Counter()
    if selected:
        urls = [b.feed_url for b in selected]
        try:
            response = client.fetch(urls)
            pages = {p.get("url"): p for p in response.get("results", []) if isinstance(p, dict) and isinstance(p.get("url"), str)}
            failed = {e.get("url"): clean_text(e.get("error")) or "fetch_failed"
                      for e in response.get("errors") or [] if isinstance(e, dict) and isinstance(e.get("url"), str)}
            for board in selected:
                page = pages.get(board.feed_url)
                if not page:
                    errors.append({"stage": "fetch", "board": board.key, "url": board.feed_url,
                                   "error": failed.get(board.feed_url, "missing_fetch_result")})
                    continue
                # Any unexpected redirect invalidates provenance; do not parse its content.
                final_url = page.get("final_url") or board.feed_url
                if canonical_url(final_url) != canonical_url(board.feed_url):
                    errors.append({"stage": "fetch", "board": board.key, "error": "unexpected_feed_redirect"})
                    continue
                try:
                    payload = parse_payload(page.get("text"))
                    page_time = page.get("_captured_at") or observed_at
                    parsed, dropped = extract_jobs(board, payload, page_time)
                    rejected.update(dropped)
                    jobs.extend(parsed)
                    fetched.append({"provider": board.provider, "employer_board": board.slug,
                                    "board_url": board.url, "feed_url": board.feed_url,
                                    "observed_at": page_time, "freshness": "ttl_zero_requested" if client.mode == "live" or (type(page.get("_capture_ttl")) in (int, float) and page.get("_capture_ttl") == 0) else "cache_status_unknown", "records_parsed": len(parsed)})
                    if board.provider == "lever" and isinstance(payload, list) and len(payload) >= 100:
                        errors.append({"stage": "coverage", "board": board.key,
                                       "error": "lever_first_100_only; narrow or choose another board"})
                except (ValueError, TypeError, AttributeError, KeyError) as exc:
                    errors.append({"stage": "parse", "board": board.key, "error": "unrecognized_job_feed_schema"})
        except APIError as exc:
            errors.append({"stage": "fetch", "error": str(exc)})
    eligible = []
    for job in jobs:
        result, reason = rank_job(job, preferences)
        if result:
            identity = (job["_board_key"], job["id"]) if job["id"] else None
            eligible.append((result, identity, job["canonical_job_url"]))
        else:
            rejected[reason] += 1
    eligible.sort(key=lambda row: (-row[0]["score"], row[0]["title"].casefold(), row[0]["employer_board"], row[2]))
    ranked, identity_seen, urls_seen = [], set(), set()
    for result, identity, url in eligible:
        if (identity and identity in identity_seen) or url in urls_seen:
            rejected["duplicate"] += 1
            continue
        if identity:
            identity_seen.add(identity)
        urls_seen.add(url)
        ranked.append(result)
    status = "failed" if not fetched else "no_matches" if not ranked else "partial" if errors else "ok"
    return {"schema_version": "1.0", "mode": client.mode, "status": status,
            "generated_at": utc_now(), "preferences": asdict(preferences),
            "tinyfish_endpoints": [SEARCH_URL, FETCH_URL],
            "jobs": ranked[:limit], "coverage": {"boards_discovered": len({d["board"] for d in discoveries}),
            "boards_selected": len(selected), "boards_attempted": len(selected) - sum(e.get("error") == "missing_capture" for e in errors), "boards_fetched": len(fetched), "job_records_parsed": len(jobs),
            "matching_jobs": len(ranked), "jobs_returned": len(ranked[:limit]), "rejected": dict(rejected),
            "scope": "Bounded discovery: prefer one Search-discovered posting per employer. Full Lever boards capped at 100 listings."},
            "sources": fetched, "discoveries": discoveries, "errors": errors, "api_calls": client.calls,
            "notes": ["Only listed public jobs with explicit HTTPS application links are returned.",
                      "Locations are literal, case-insensitive matches; no geographic or visa eligibility is inferred.",
                      "Missing fields are null. Ranking is a transparent keyword heuristic, not a hiring recommendation.",
                      "Fixture mode is synthetic and never proves live API operation." if client.mode == "fixture" else
                      "Live REST: TinyFish Fetch ttl=0 requested; origin caching may still return older content." if client.mode == "live" else
                      "Imported TinyFish responses: authenticity depends on the supplied capture; Python REST was not exercised. Origin caching may still return older content."]}


def write_html(report, path):
    escape = lambda value: html.escape(str(value), quote=True)
    jobs = []
    for job in report["jobs"]:
        jobs.append(f'''<article class="job"><div class="job-top"><span class="board">{escape(job['company'] or job['employer_board'])} · {escape(job['provider'])}</span><span class="score">{job['score']} match</span></div>
<h2>{escape(job['title'])}</h2><div class="location">{escape(' · '.join(job['locations']) or 'Location not provided')} · {escape(job['work_mode'] or 'Work mode not provided')}</div>
<p>{escape(job['description_excerpt'])}</p><ul>{''.join('<li>'+escape(r)+'</li>' for r in job['match_reasons'])}</ul>
<div class="actions"><a target="_blank" rel="noopener noreferrer" href="{escape(job['apply_url'])}">View application ↗</a><a class="subtle" target="_blank" rel="noopener noreferrer" href="{escape(job['source_feed_url'])}">Source feed</a></div></article>''')
    pref = report["preferences"]
    label = {"fixture": "SYNTHETIC OFFLINE DEMO", "live": "LIVE TINYFISH REST SNAPSHOT",
             "mcp_capture": "TINYFISH MCP CAPTURE", "playground_capture": "TINYFISH PLAYGROUND CAPTURE"}[report["mode"]]
    sources = ''.join(f'<li><a href="{escape(s["board_url"])}" target="_blank" rel="noopener noreferrer">{escape(s["employer_board"])}</a> · {escape(s["provider"])} · {s["records_parsed"]} listings · captured {escape(s["observed_at"])}</li>' for s in report["sources"])
    errors = ''.join('<li>'+escape(e.get("board") or e.get("provider") or e["stage"])+': '+escape(e["error"])+'</li>' for e in report["errors"])
    document = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Careers Scout · Job shortlist</title><style>
:root{{--ink:#102b27;--green:#176d51;--muted:#5b726b;--paper:#f3f5ed;--line:#d8e1d6}}*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,sans-serif}}main{{max-width:1140px;margin:auto;padding:38px 24px 70px}}header{{border-bottom:1px solid var(--line);padding-bottom:24px;display:flex;justify-content:space-between;gap:20px;align-items:center}}.brand{{font-size:22px;font-weight:800;letter-spacing:-.6px}}.badge{{font-size:11px;font-weight:800;letter-spacing:1.2px;border:1px solid var(--green);color:var(--green);border-radius:99px;padding:7px 12px}}.hero{{padding:42px 0 28px}}h1{{font-size:clamp(32px,5vw,58px);letter-spacing:-2px;line-height:1.08;max-width:850px;margin:8px 0 20px}}.kicker{{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--green);font-weight:800}}.intro{{color:var(--muted);max-width:700px}}.chips{{display:flex;gap:9px;flex-wrap:wrap;margin:20px 0}}.chip{{border:1px solid var(--line);border-radius:30px;padding:5px 13px;font-size:13px;background:#fff}}.stats{{display:flex;gap:32px;padding:20px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:30px}}.stat strong{{font-size:27px;display:block}}.stat span{{font-size:12px;color:var(--muted)}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}}.job{{background:#fff;border:1px solid var(--line);padding:25px;border-radius:16px}}.job-top{{display:flex;justify-content:space-between;gap:10px}}.board{{font-size:12px;color:var(--muted);overflow-wrap:anywhere}}.score{{font-size:11px;white-space:nowrap;background:#e8f4d8;color:#2c5d25;padding:3px 8px;border-radius:20px;font-weight:700}}h2{{font-size:22px;line-height:1.25;margin:17px 0 10px;letter-spacing:-.4px}}.location{{font-size:13px;color:var(--green)}}.job p,.job li{{font-size:13px;color:var(--muted)}}.job ul{{padding-left:18px}}.actions{{display:flex;align-items:center;gap:20px;margin-top:22px}}a{{color:var(--green)}}.actions>a:first-child{{background:var(--green);color:#fff;padding:9px 14px;border-radius:7px;text-decoration:none;font-weight:650;font-size:13px}}.subtle{{font-size:12px}}.audit{{margin-top:35px;border-top:1px solid var(--line);padding-top:20px;font-size:13px;color:var(--muted)}}.audit h2{{font-size:18px;color:var(--ink)}}.empty{{padding:30px;background:#fff;border-radius:12px}}@media(max-width:700px){{.grid{{grid-template-columns:1fr}}header{{align-items:flex-start;flex-direction:column}}.stats{{gap:20px}}}}
</style></head><body><main><header><div class="brand">↗ Careers Scout</div><div class="badge">{label}</div></header><section class="hero"><div class="kicker">TinyFish Search + Fetch</div><h1>A shortlist with a source<br>behind every opportunity.</h1><p class="intro">Current public career boards, filtered by your preferences and ranked with visible reasons. No résumé upload, no automated applications.</p><div class="chips"><span class="chip">{escape(' / '.join(pref['roles']))}</span><span class="chip">{escape(pref['location'] or 'Any listed location')}</span><span class="chip">Remote: {escape(pref['remote'])}</span>{''.join('<span class="chip">'+escape(k)+'</span>' for k in pref['keywords'] or [])}</div></section><div class="stats"><div class="stat"><strong>{len(report['jobs'])}</strong><span>shortlisted roles</span></div><div class="stat"><strong>{report['coverage']['boards_fetched']}</strong><span>employer boards read</span></div><div class="stat"><strong>{report['coverage']['job_records_parsed']}</strong><span>listings filtered</span></div></div><section class="grid">{''.join(jobs) or '<div class="empty">No verified matches. Broaden the preferences or review the source errors below.</div>'}</section><section class="audit"><h2>Evidence & coverage</h2><p>Status: {escape(report['status'])} · Generated {escape(report['generated_at'])}</p><ul>{sources}</ul><p>{escape(report['coverage']['scope'])}</p><p>Match score = 50 for role-title tokens + 15 for the exact role phrase + 15 for an explicit location match + 10 for a confirmed requested work mode + 8 per matched keyword (maximum 24), capped at 100.</p><p>Company names are shown when provided; otherwise ATS board identifiers are used. Missing fields remain unknown. Remote never implies worldwide eligibility. Open the posting to verify current availability and restrictions.</p>{'<h2>Partial failures</h2><ul>'+errors+'</ul>' if errors else ''}<p>This is a timestamped report, not a continuously refreshing job portal. {'All listings in this demo are invented test fixtures; no live API calls were made.' if report['mode']=='fixture' else 'Discovery and retrieval ran through TinyFish. See JSON source freshness fields for ttl=0 requested versus unknown cache status; origin caching may still serve older data.'}</p></section></main></body></html>'''
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(document, encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--role", action="append", required=True, help="Role title; repeat for alternatives")
    parser.add_argument("--location", default="", help="Literal listed-location match, e.g. London")
    parser.add_argument("--keyword", action="append", default=[], help="Ranking keyword; repeatable")
    parser.add_argument("--exclude", action="append", default=[], help="Exclude jobs containing this phrase")
    parser.add_argument("--remote", choices=("any", "only", "exclude"), default="any")
    parser.add_argument("--require-keywords", action="store_true")
    parser.add_argument("--provider", action="append", choices=PROVIDERS, help="Default: greenhouse. Lever/Ashby are experimental opt-ins.")
    parser.add_argument("--country", default="US", help="Search localization, not a job eligibility filter")
    parser.add_argument("--language", default="en")
    parser.add_argument("--board", action="append", default=[], help="Prioritize a supported ATS board URL")
    parser.add_argument("--max-boards", type=int, default=6, choices=range(1, 11), metavar="1..10")
    parser.add_argument("--limit", type=int, default=20, choices=range(1, 101), metavar="1..100")
    parser.add_argument("--json", dest="json_path", default="output/jobs.json")
    parser.add_argument("--html", dest="html_path", default="output/jobs.html")
    parser.add_argument("--fixture", help="Explicit SYNTHETIC offline demonstration; never live evidence")
    parser.add_argument("--capture", help="JSON capture of genuine TinyFish MCP/playground responses")
    parser.add_argument("--plan", action="store_true", help="Emit Search requests; no network or credentials")
    parser.add_argument("--prepare-fetch", action="store_true", help="Discover boards and emit the Fetch payload only")
    args = parser.parse_args(argv)
    terms = args.role + [args.location] + args.keyword + args.exclude
    if any(len(s) > 160 or re.search(r"[\x00-\x1f]", s) for s in terms) or any(not clean_text(r) for r in args.role):
        parser.error("Preferences must be nonempty roles and ≤160-character plain-text terms.")
    if len(args.role) > 3 or len(args.keyword) > 12 or len(args.exclude) > 12 or len(args.board) > 10:
        parser.error("Use at most 3 roles, 12 keywords, 12 exclusions, and 10 boards.")
    if not re.fullmatch(r"[A-Za-z]{2}", args.country) or not re.fullmatch(r"[a-z]{2}(?:-[A-Z]{2})?", args.language):
        parser.error("Use a two-letter country and a language code such as en.")
    preferences = Preferences([clean_text(r) for r in args.role], clean_text(args.location),
        [clean_text(k) for k in args.keyword if clean_text(k)], [clean_text(k) for k in args.exclude if clean_text(k)],
        args.remote, args.require_keywords, args.country.upper(), args.language, list(dict.fromkeys(args.provider or ["greenhouse"])))
    if args.fixture and args.capture:
        parser.error("Choose either --fixture or --capture, never both.")
    if args.plan:
        print(json.dumps({"search": [{"provider": p, "query": query_for(p, preferences),
              "location": preferences.country, "language": preferences.language} for p in preferences.providers]}, indent=2))
        return 0
    try:
        client = (FixtureClient(args.fixture) if args.fixture else CaptureClient(args.capture) if args.capture
                  else TinyFishClient(os.environ.get("TINYFISH_API_KEY", "")))
        report = find_jobs(preferences, client, args.board, args.max_boards, args.limit, prepare_only=args.prepare_fetch)
        if args.prepare_fetch:
            Path(args.json_path).parent.mkdir(parents=True, exist_ok=True)
            Path(args.json_path).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(report, indent=2))
            return 0 if report["fetch_request"]["urls"] else 2
        Path(args.json_path).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json_path).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        write_html(report, args.html_path)
    except (APIError, ValueError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    print(f"{report['mode'].upper()} | {report['status']} | {len(report['jobs'])} matches | "
          f"{report['coverage']['boards_fetched']} boards read")
    print(f"JSON: {args.json_path}\nHTML: {args.html_path}")
    for job in report["jobs"][:5]:
        print(f"{job['score']:>3}  {job['title']} · {job['employer_board']} · {', '.join(job['locations']) or 'location unknown'}")
        print(f"     {job['apply_url']}")
    if report["errors"]:
        print(f"{len(report['errors'])} source issues recorded; inspect JSON errors before using the shortlist.", file=sys.stderr)
    return 2 if report["status"] == "failed" else 3 if report["status"] == "no_matches" else 0


if __name__ == "__main__":
    raise SystemExit(main())
