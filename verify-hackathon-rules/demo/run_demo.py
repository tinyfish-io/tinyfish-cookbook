#!/usr/bin/env python3
"""Run the real pipeline against synthetic TinyFish-shaped responses; no network."""
import argparse
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "skills/verify-hackathon-rules/scripts"))
import rules

NOW = rules.aware("2026-10-14T03:02:00+00:00")
URL = "https://sprint.example.org/rules"
TEXT = """# Example Sprint 2026 (synthetic fixture)
Submissions close October 15, 2026 at 11:59 PM US Pacific Time.
Participants must be currently enrolled college students.
Submit a public repository link and a two-minute demo video.
"""


class FixtureClient:
    requests = 0

    def search(self, query):
        self.requests += 1
        return {"query": query, "results": [
            {"url": URL + "#deadline", "title": "Example Sprint 2026"},
            {"url": URL, "title": "Duplicate"},
            {"url": "https://unrelated.example.org/old", "title": "Old edition"}]}

    def fetch(self, urls):
        self.requests += 1
        return {"results": [{"url": URL, "final_url": URL, "title": "Example Sprint 2026", "text": TEXT}], "errors": []}


def inputs():
    snapshot = rules.collect(FixtureClient(), [], ["sprint.example.org"], "Example Sprint 2026 official rules", NOW)
    snapshot["mode"] = "fixture"
    snapshot["api_requests"] = 0
    snapshot["fixture_note"] = "Synthetic contract replay; no TinyFish requests were made."
    def claim(cid, kind, value, quote):
        return {"id": cid, "kind": kind, "value": value, "evidence": [{"source_id": "s1", "quote": quote}]}
    claims = {"schema_version": 1, "event": "Example Sprint 2026 (synthetic)", "claims": [
        claim("submission-deadline", "deadline", {"local": "2026-10-15T23:59", "zone": "America/Los_Angeles"}, TEXT.splitlines()[1]),
        claim("student-status", "eligibility", "Currently enrolled college students only.", TEXT.splitlines()[2]),
        claim("required-repository", "deliverable", "Provide a public repository link.", TEXT.splitlines()[3]),
        claim("required-demo", "deliverable", "Provide a two-minute demo video.", TEXT.splitlines()[3])
    ]}
    return snapshot, claims


def run(out):
    out = Path(out)
    rules.require(not out.exists(), "Demo output exists; choose a fresh directory")
    snapshot, claims = inputs()
    report = rules.evaluate(snapshot, claims, now=NOW)
    changed = copy.deepcopy(snapshot)
    changed["sources"][0]["text"] = TEXT.replace("two-minute", "three-minute")
    changed["sources"][0]["sha256"] = rules.digest(changed["sources"][0]["text"])
    recheck = rules.evaluate(changed, claims, now=NOW)
    tampered = copy.deepcopy(claims)
    tampered["claims"][0]["evidence"][0]["quote"] = "Every entrant is guaranteed a cash prize of $1,000."
    rejection = rules.evaluate(snapshot, tampered, now=NOW)
    for name, value in [("snapshot.json", snapshot), ("claims.json", claims),
                        ("report.json", report), ("report.md", rules.markdown(report)),
                        ("changed-snapshot.json", changed), ("changes.json", rules.compare(snapshot, changed)),
                        ("recheck.json", recheck), ("fabricated-quote.json", rejection)]:
        rules.write_new(out / name, value)
    messages = [
        "VERIFY HACKATHON RULES | OFFLINE FIXTURE REPLAY",
        "Synthetic Example Sprint 2026; network requests: 0",
        "Search candidates: 3 -> official unique pages: 1",
        f"Source SHA-256: {snapshot['sources'][0]['sha256'][:16]}...",
        f"Deadline (US Pacific): {claims['claims'][0]['value']['local']}",
        f"Deadline (Asia/Kolkata): {report['claims'][0]['local']}",
        "Evidence: 4 claims with exact source quotes",
        "Checklist: repository + demo; both unchecked",
        f"Status: {report['status']} (fixture is never live proof)",
        "Changed rule: two-minute -> three-minute demo",
        "Diff: changed; old deliverable quotes now fail",
        "Fabricated prize quote: rejected",
        "No registration, social post, or submission performed.",
    ]
    rules.write_new(out / "transcript.txt", "\n".join(messages) + "\n")
    print("\n".join(messages))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    try:
        run(parser.parse_args().out)
    except rules.RulesError as err:
        sys.exit(str(err))
