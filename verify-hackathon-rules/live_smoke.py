#!/usr/bin/env python3
"""Opt-in real TinyFish Search/Fetch contract smoke test; no paid Agent endpoint."""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills/verify-hackathon-rules/scripts"))
import rules

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--within-free-allowance", action="store_true")
parser.add_argument("--out", default="verify-hackathon-rules/live-output/snapshot.json")
args = parser.parse_args()
if not os.environ.get("TINYFISH_API_KEY"):
    sys.exit("LIVE SMOKE NOT RUN: TINYFISH_API_KEY is unavailable. No API request made.")
if not args.within_free_allowance:
    sys.exit("Check remaining free allowance before passing --within-free-allowance.")
try:
    rules.require(not Path(args.out).exists(), "Choose a fresh output path")
    client = rules.TinyFish()
    # Search must return at least one result to count as a successful smoke test.
    result = client.search("site:docs.tinyfish.ai TinyFish Search Fetch API")
    rules.require(bool(result["results"]), "Search returned no results; smoke test incomplete")
    snapshot = rules.collect(client, ["https://docs.tinyfish.ai/search-api/reference",
                                      "https://docs.tinyfish.ai/fetch-api/reference"],
                             ["docs.tinyfish.ai"])
    rules.validate_snapshot(snapshot)
    rules.write_new(args.out, snapshot)
    rules.require(len(snapshot["sources"]) == 2 and not snapshot["errors"], "Fetch smoke test incomplete; inspect captured errors")
    print(f"LIVE SMOKE PASSED: Search returned {len(result['results'])} candidates; fetched 2 nonempty documentation pages; {client.requests} HTTP attempts.")
    print(f"Saved evidence: {args.out}")
    print("This validates API integration only, not any event's rules or bounty acceptance.")
except (rules.RulesError, OSError) as err:
    sys.exit(str(err) if isinstance(err, rules.RulesError) else "Cannot save smoke-test output")
