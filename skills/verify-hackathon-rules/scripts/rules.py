#!/usr/bin/env python3
"""Bounded TinyFish retrieval and deterministic evidence checks (Python 3.10+)."""
from __future__ import annotations

import argparse
import hashlib
import html
import ipaddress
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = timezone.utc
SEARCH = "https://api.search.tinyfish.ai"
FETCH = "https://api.fetch.tinyfish.ai"
KINDS = {"deadline", "eligibility", "deliverable", "prize"}
MAX_BYTES = 8 * 1024 * 1024


class RulesError(ValueError):
    """Safe, user-facing error without response bodies or credentials."""


def require(condition, message):
    if not condition:
        raise RulesError(message)


def canonical_url(value):
    require(isinstance(value, str) and len(value) <= 4096, "Invalid URL")
    require(not re.search(r"[\s\\\x00-\x1f]", value), "Invalid URL characters")
    try:
        u = urlsplit(value)
        host = (u.hostname or "").encode("idna").decode().lower().rstrip(".")
        port = u.port
    except (ValueError, UnicodeError):
        raise RulesError("Invalid URL") from None
    require(u.scheme == "https" and host and not u.username and not u.password,
            "Use public HTTPS URLs without credentials")
    require(port in (None, 443), "Only standard HTTPS is supported")
    require("." in host and not host.endswith((".local", ".localhost", ".internal")),
            "Local hosts are not supported")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    require(address is None or address.is_global, "Private addresses are not supported")
    require(not re.fullmatch(r"[0-9.]+", host) or address is not None, "Invalid numeric host")
    # Keep path/query case, ordering and trailing slash: they can be meaningful.
    return urlunsplit(("https", host, u.path or "/", u.query, ""))


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def aware(value):
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError):
        raise RulesError("Expected an ISO timestamp with an explicit UTC offset") from None
    require(result.tzinfo is not None, "Timestamp requires a UTC offset")
    return result


def zone(value):
    require(isinstance(value, str) and ("/" in value or value == "UTC"),
            "Use an IANA timezone, not an abbreviation such as IST or PT")
    try:
        return ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise RulesError("Unknown IANA timezone; install tzdata if needed") from None


def deadline(value):
    require(isinstance(value, dict), "Deadline requires local and zone")
    local = value.get("local", "")
    require(isinstance(local, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?", local),
            "Deadline requires an explicit year, date and local time")
    try:
        naive = datetime.fromisoformat(local)
    except ValueError:
        raise RulesError("Invalid deadline date") from None
    tz = zone(value.get("zone"))
    instants = set()
    for fold in (0, 1):
        candidate = naive.replace(tzinfo=tz, fold=fold).astimezone(UTC)
        if candidate.astimezone(tz).replace(tzinfo=None) == naive:
            instants.add(candidate)
    require(len(instants) == 1, "Ambiguous or nonexistent DST time; ask the organizer")
    return instants.pop()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Do not forward the API key to a redirected service.
        return None


class TinyFish:
    def __init__(self, key=None, opener=None, sleep=time.sleep, attempts=3):
        self.key = key if key is not None else os.environ.get("TINYFISH_API_KEY", "")
        require(bool(self.key.strip()), "Set TINYFISH_API_KEY in your environment; never put it in a file or prompt")
        require(attempts in (1, 2, 3), "Retry budget must be 1-3 attempts")
        self.opener = opener or build_opener(NoRedirect()).open
        self.sleep, self.attempts, self.requests = sleep, attempts, 0

    def request(self, endpoint, payload=None):
        require(endpoint == FETCH or endpoint.startswith(SEARCH + "?"), "Unsupported endpoint")
        for attempt in range(self.attempts):
            req = Request(endpoint, data=None if payload is None else json.dumps(payload).encode(),
                          headers={"X-API-Key": self.key, "Content-Type": "application/json"})
            self.requests += 1
            try:
                with self.opener(req, timeout=150) as response:
                    raw = response.read(MAX_BYTES + 1)
                require(len(raw) <= MAX_BYTES, "API response exceeds the 8 MiB safety limit")
                result = json.loads(raw)
                require(isinstance(result, dict), "Unexpected API response shape")
                return result
            except HTTPError as err:
                status = err.code
                retry_after = err.headers.get("Retry-After") if err.headers else None
                err.close()
                if status not in (429, 500, 502, 503, 504) or attempt + 1 == self.attempts:
                    raise RulesError(f"TinyFish HTTP {status}; no successful live result") from None
                delay = 2 ** attempt
                if retry_after:
                    try:
                        delay = max(delay, float(retry_after))
                    except ValueError:
                        try:
                            delay = max(delay, (parsedate_to_datetime(retry_after) - datetime.now(UTC)).total_seconds())
                        except (ValueError, TypeError, OverflowError):
                            raise RulesError("Invalid Retry-After; retry later") from None
                require(0 <= delay <= 30, "Retry-After exceeds the wait budget; retry later")
                self.sleep(delay)
            except (URLError, TimeoutError, OSError):
                raise RulesError("TinyFish network failure; no successful live result") from None
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise RulesError("TinyFish returned invalid JSON") from None
        raise RulesError("Retry budget exhausted")

    def search(self, query):
        require(isinstance(query, str) and 1 <= len(query.strip()) <= 1000, "Query must be 1-1000 characters")
        data = self.request(SEARCH + "?" + urlencode({"query": query}))
        require(isinstance(data.get("results"), list), "Search response lacks results[]")
        return data

    def fetch(self, urls):
        require(1 <= len(urls) <= 10, "Fetch requires 1-10 URLs")
        return self.request(FETCH, {"urls": urls, "format": "markdown", "ttl": 0,
                                   "per_url_timeout_ms": 45000})


def domains(values):
    require(isinstance(values, list) and all(isinstance(v, str) for v in values), "Domains must be a list of hostnames")
    require(all(not re.search(r"[/@:#?]", v) for v in values), "Allow exact hostnames only")
    return {urlsplit(canonical_url("https://" + v)).hostname for v in values}


def collect(client, urls, official_domains, query=None, now=None):
    """One optional Search + one Fetch batch; selected domains are user/agent asserted."""
    allowed = domains(official_domains)
    require(allowed, "Specify at least one organizer-confirmed domain")
    selected, candidates = [], []

    def select(raw, explicit=False):
        try:
            url = canonical_url(raw)
            require(urlsplit(url).hostname in allowed, "URL is outside the exact allowed domains")
        except RulesError:
            if explicit:
                raise
            return
        if url not in selected and len(selected) < 10:
            selected.append(url)

    require(len(urls) <= 10, "At most 10 explicit URLs")
    for url in urls:
        select(url, True)
    if query:
        for row in client.search(query)["results"]:
            if isinstance(row, dict) and isinstance(row.get("url"), str):
                select(row["url"])
                # Snippets are discovery aids, never rule evidence.
                candidates.append({"url": row["url"], "title": row.get("title")})
    require(selected, "No allowed URLs found; supply an official rules URL")
    data = client.fetch(selected)
    require(isinstance(data.get("results"), list) and isinstance(data.get("errors", []), list),
            "Fetch response must contain results[] and optional errors[]")
    timestamp = (now or datetime.now(UTC)).isoformat()
    sources, failures, returned = [], [], set()
    for row in data["results"]:
        require(isinstance(row, dict), "Malformed fetch result")
        original = canonical_url(row.get("url"))
        require(original in selected and original not in returned, "Unexpected or duplicate result URL")
        returned.add(original)
        text = row.get("text")
        try:
            final = canonical_url(row.get("final_url") or original)
            require(urlsplit(final).hostname in allowed, "redirect_outside_allowed_domains")
            require(isinstance(text, str) and text.strip(), "empty_or_nontext_content")
        except RulesError as err:
            failures.append({"url": original, "error": str(err)})
            continue
        sources.append({"id": "s" + str(len(sources) + 1), "url": original, "final_url": final,
                        "title": row.get("title") or "Untitled", "text": text,
                        "sha256": digest(text), "fetched_at": timestamp})
    for row in data.get("errors", []):
        require(isinstance(row, dict), "Malformed fetch error")
        url = canonical_url(row.get("url"))
        require(url in selected and url not in returned, "Unexpected or duplicate error URL")
        returned.add(url)
        code = row.get("error", "fetch_failed")
        # Preserve machine codes, never arbitrary upstream message bodies.
        code = code if isinstance(code, str) and re.fullmatch(r"[a-z_]{1,60}", code) else "fetch_failed"
        failures.append({"url": url, "error": code})
    for url in selected:
        if url not in returned:
            failures.append({"url": url, "error": "missing_from_response"})
    return {"schema_version": 1, "mode": "live", "created_at": timestamp,
            "allowed_domains": sorted(allowed), "api_requests": client.requests,
            "requested_urls": selected, "candidates": candidates,
            "sources": sources, "errors": failures}


def validate_snapshot(snapshot):
    require(isinstance(snapshot, dict) and snapshot.get("schema_version") == 1, "Unknown snapshot schema")
    require(snapshot.get("mode") in ("live", "fixture"), "Snapshot mode must be live or fixture")
    require(isinstance(snapshot.get("sources"), list), "Snapshot requires sources[]")
    require(isinstance(snapshot.get("errors"), list), "Snapshot requires errors[]")
    allowed = domains(snapshot.get("allowed_domains", []))
    sources = {}
    for row in snapshot["sources"]:
        require(isinstance(row, dict), "Invalid source")
        sid, text = row.get("id"), row.get("text")
        require(isinstance(sid, str) and re.fullmatch(r"s[1-9][0-9]*", sid) and sid not in sources,
                "Invalid or duplicate source ID")
        require(isinstance(text, str) and digest(text) == row.get("sha256"), "Snapshot content hash mismatch")
        for key in ("url", "final_url"):
            require(urlsplit(canonical_url(row.get(key))).hostname in allowed, "Source outside allowed domains")
        aware(row.get("fetched_at"))
        sources[sid] = row
    return sources


def quote_location(source, quote):
    require(isinstance(quote, str) and len(quote.strip()) >= 12, "Use a meaningful verbatim quote (12+ characters)")
    index = source["text"].find(quote)
    require(index >= 0, "Quote does not occur verbatim in the fetched source")
    start = source["text"][:index].count("\n") + 1
    return [start, start + quote.count("\n")]


def evaluate(snapshot, claims, display_zone="Asia/Kolkata", now=None, max_age_hours=24):
    sources = validate_snapshot(snapshot)
    require(isinstance(claims, dict) and claims.get("schema_version") == 1, "Unknown claims schema")
    require(isinstance(claims.get("claims"), list), "Claims requires claims[]")
    require(isinstance(claims.get("event"), str) and claims["event"].strip(), "Event name required")
    require(0 < max_age_hours <= 168, "Freshness budget must be 1-168 hours")
    target, now = zone(display_zone), now or datetime.now(UTC)
    require(now.tzinfo is not None, "Current time requires a timezone")
    checked, groups = [], {}
    blockers = []
    if snapshot["mode"] != "live":
        blockers.append("Fixture replay only: no live API validation")
    if snapshot["errors"]:
        blockers.append("Some requested sources failed or returned incomplete content")
    if not sources:
        blockers.append("No fetched source evidence")
    for sid, source in sources.items():
        age = (now - aware(source["fetched_at"])).total_seconds() / 3600
        if age > max_age_hours or age < -1 / 60:
            blockers.append(f"{sid}: stale or future-dated evidence; collect again")
    for number, item in enumerate(claims["claims"], 1):
        require(isinstance(item, dict), "Each claim must be an object")
        cid, kind = item.get("id"), item.get("kind")
        require(isinstance(cid, str) and re.fullmatch(r"[a-z][a-z0-9-]{0,63}", cid), "Invalid claim ID")
        require(isinstance(kind, str) and kind in KINDS, "Unknown claim kind")
        value = item.get("value")
        row = {"id": cid, "kind": kind, "value": value, "evidence": [], "issues": []}
        evidence = item.get("evidence", [])
        require(isinstance(evidence, list), "Evidence must be an array")
        if value is None:
            row["issues"].append("unknown value; clarification needed")
        if not evidence:
            row["issues"].append("missing source evidence")
        for ref in evidence:
            try:
                require(isinstance(ref, dict), "Invalid evidence reference")
                require(isinstance(ref.get("source_id"), str), "Invalid source ID")
                source = sources.get(ref.get("source_id"))
                require(source is not None, "Unknown source ID")
                lines = quote_location(source, ref.get("quote"))
                row["evidence"].append({**ref, "lines": lines, "url": source["final_url"]})
            except RulesError as err:
                row["issues"].append(str(err))
        normalized = json.dumps(value, sort_keys=True)
        if value is not None:
            try:
                if kind == "deadline":
                    instant = deadline(value)
                    row["utc"] = instant.isoformat()
                    row["local"] = instant.astimezone(target).isoformat()
                    row["hours_remaining"] = round((instant - now).total_seconds() / 3600, 2)
                    normalized = row["utc"]
                    if instant <= now:
                        row["issues"].append("deadline has passed")
                else:
                    require(isinstance(value, str) and value.strip(), "Non-deadline values must be nonempty text")
            except RulesError as err:
                row["issues"].append(str(err))
        row["quote_status"] = "matched" if row["evidence"] and not row["issues"] else "needs_review"
        checked.append(row)
        groups.setdefault(cid, []).append((kind, normalized, row))
    for cid, entries in groups.items():
        if len({(kind, value) for kind, value, _ in entries}) > 1:
            blockers.append(f"Conflicting values for {cid}; consult the organizer")
            for _, _, row in entries:
                row["issues"].append("conflicting source claims")
                row["quote_status"] = "needs_review"
    for kind in ("deadline", "eligibility", "deliverable"):
        if not any(row["kind"] == kind for row in checked):
            blockers.append(f"Missing {kind} assessment")
    if any(row["issues"] for row in checked):
        blockers.append("One or more claims need review")
    return {"schema_version": 1, "event": claims["event"], "mode": snapshot["mode"],
            "checked_at": now.isoformat(), "display_zone": display_zone,
            "status": "needs_review" if blockers else "ready_for_human_review",
            "blockers": blockers, "claims": checked, "fetch_errors": snapshot["errors"],
            "notice": "Quote matching verifies provenance, not semantic correctness, eligibility, completeness or submission."}


def compare(before, after):
    old, new = validate_snapshot(before), validate_snapshot(after)
    a = {r["url"]: r for r in old.values()}
    b = {r["url"]: r for r in new.values()}
    rows = []
    for url in sorted(a.keys() | b.keys()):
        status = "added" if url not in a else "unavailable" if url not in b else (
            "unchanged" if a[url]["sha256"] == b[url]["sha256"] else "changed")
        rows.append({"url": url, "status": status})
    return {"sources": rows, "after_fetch_errors": after["errors"],
            "notice": "Changed text requires claim re-extraction; unavailable does not mean a rule was removed."}


def safe(value):
    return html.escape(str(value), quote=True).replace("|", "&#124;").replace("\n", " ")


def markdown(report):
    lines = [f"# {safe(report['event'])}", "", f"Status: **{report['status']}** | Mode: **{report['mode']}**",
             f"Checked: {report['checked_at']} | Display zone: {report['display_zone']}", "", report["notice"], "",
             "## Review blockers", ""]
    lines += ["- " + safe(b) for b in report["blockers"]] or ["- No mechanical blockers. Review meaning and completeness."]
    lines += ["", "## Evidence ledger", "", "| Rule | Value | Check |", "|---|---|---|"]
    for row in report["claims"]:
        value = row.get("local", "Unknown — clarification needed" if row["value"] is None else json.dumps(row["value"], ensure_ascii=False))
        lines.append(f"| {safe(row['id'])} ({row['kind']}) | {safe(value)} | {row['quote_status']} |")
    for row in report["claims"]:
        lines += ["", f"### {safe(row['id'])}", ""]
        for ref in row["evidence"]:
            lines += [f"- {safe(ref['source_id'])}, snapshot lines {ref['lines'][0]}–{ref['lines'][1]}: {safe(ref['url'])}",
                      f"  > {safe(ref['quote'])}"]
        lines += ["- Review: " + safe(issue) for issue in row["issues"]]
    lines += ["", "## Submission checklist — completion not verified", ""]
    lines += [f"- [ ] {safe(row['value'])} ({safe(row['id'])})" for row in report["claims"] if row["kind"] == "deliverable" and row["value"] is not None]
    lines += [f"- Clarify unknown deliverable: {safe(row['id'])}" for row in report["claims"] if row["kind"] == "deliverable" and row["value"] is None]
    lines += ["- [ ] Check the current organizer portal, eligibility and source meaning.",
              "- [ ] Submit only with user authorization; retain the actual confirmation.", ""]
    return "\n".join(lines)


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise RulesError("Cannot read a valid UTF-8 JSON input file") from None


def write_new(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Runs are immutable by default; a recheck must use a new output path.
    with path.open("x", encoding="utf-8") as out:
        out.write(value if isinstance(value, str) else json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    c = sub.add_parser("collect", help="Search and fetch official rule pages via TinyFish")
    c.add_argument("--url", action="append", default=[])
    c.add_argument("--official-domain", action="append", required=True)
    c.add_argument("--query")
    c.add_argument("--out", required=True)
    c.add_argument("--within-free-allowance", action="store_true", help="Confirm remaining TinyFish free allowance before network access")
    r = sub.add_parser("report", help="Check source quotes and convert explicit deadlines")
    r.add_argument("--snapshot", required=True)
    r.add_argument("--claims", required=True)
    r.add_argument("--timezone", default="Asia/Kolkata")
    r.add_argument("--now", help="Pinned clock for replay only; report records this time")
    r.add_argument("--max-age-hours", type=float, default=24)
    r.add_argument("--out", required=True, help="New directory for report.json and report.md")
    d = sub.add_parser("diff", help="Compare two captured snapshots")
    d.add_argument("before")
    d.add_argument("after")
    d.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "collect":
            require(not Path(args.out).exists(), "Output exists; choose a fresh path")
            require(args.within_free_allowance, "Check remaining free allowance, then add --within-free-allowance")
            result = collect(TinyFish(), args.url, args.official_domain, args.query)
            write_new(args.out, result)
            print(f"Captured {len(result['sources'])} sources; {len(result['errors'])} errors; {result['api_requests']} HTTP attempts")
            return 0 if result["sources"] and not result["errors"] else 3
        if args.command == "report":
            require(not Path(args.out).exists(), "Output directory exists; choose a fresh path")
            snapshot = read_json(args.snapshot)
            if args.now:
                require(snapshot.get("mode") == "fixture", "--now is restricted to fixture replay")
            report = evaluate(snapshot, read_json(args.claims), args.timezone,
                              aware(args.now) if args.now else None, args.max_age_hours)
            write_new(Path(args.out) / "report.json", report)
            write_new(Path(args.out) / "report.md", markdown(report))
            print(f"{report['status']}: {len(report['claims'])} claims; {len(report['blockers'])} blockers")
            return 0 if report["status"] == "ready_for_human_review" else 3
        write_new(args.out, compare(read_json(args.before), read_json(args.after)))
        print("Snapshot comparison saved")
        return 0
    except (RulesError, OSError) as err:
        # Never emit raw urllib exceptions; they may contain headers or URLs.
        message = str(err) if isinstance(err, RulesError) else "Output could not be written; choose a new writable path"
        print("Error: " + message, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
