"""Report rendering tests."""

import json

from docs_drift_radar.report import render_json, render_markdown, summarize

DRIFT = {
    "slug": "docs-example-com",
    "label": "Docs",
    "url": "https://docs.example.com",
    "detected_at": "2026-09-27T10:00:00+00:00",
    "added": 2,
    "removed": 1,
    "labels": ["breaking", "addition"],
    "is_breaking": True,
    "classification": "breaking,addition",
    "diff": "--- a\n+++ b\n-old line\n+new line",
}


def test_summarize_counts_sources_and_breaking():
    totals = summarize([DRIFT, {**DRIFT, "slug": "other", "is_breaking": False}])
    assert totals == {"drifts": 2, "sources": 2, "breaking": 1}
    assert summarize([]) == {"drifts": 0, "sources": 0, "breaking": 0}


def test_markdown_report_with_a_drift():
    report = render_markdown([DRIFT], generated_at="2026-09-27T10:05:00+00:00")

    assert "# Docs Drift Radar" in report
    assert "**1 drift(s)**" in report
    assert "**1 breaking**" in report
    assert "## docs-example-com" in report
    assert "https://docs.example.com" in report
    assert "`breaking` `addition`" in report
    assert "```diff" in report
    assert "+new line" in report


def test_markdown_report_is_honest_when_empty():
    report = render_markdown([], generated_at="2026-09-27T10:05:00+00:00")
    assert "No drift recorded in this window." in report
    assert "```diff" not in report


def test_long_diff_is_truncated_in_the_report():
    drift = {**DRIFT, "diff": "\n".join(f"line {index}" for index in range(100))}
    report = render_markdown([drift], max_diff_lines=5)
    assert "... diff truncated at 5 of 100 lines" in report


def test_json_report_keeps_the_diff():
    payload = render_json([DRIFT], since="2026-01-01T00:00:00+00:00")

    # Round-trips, so the CLI and the API can both serialise it.
    json.dumps(payload)
    assert payload["since"] == "2026-01-01T00:00:00+00:00"
    assert payload["totals"] == {"drifts": 1, "sources": 1, "breaking": 1}
    assert payload["drifts"][0]["labels"] == ["breaking", "addition"]
    assert payload["drifts"][0]["is_breaking"] is True
    assert "-old line" in payload["drifts"][0]["diff"]


def test_json_report_omits_internal_only_fields():
    payload = render_json([DRIFT])
    assert "classification" not in payload["drifts"][0]
