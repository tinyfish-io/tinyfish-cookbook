"""Diff and classification tests."""

from docs_drift_radar.diffing import (
    CLASSIFICATION_ORDER,
    build_drift_summary,
    changed_lines,
    classify,
    count_changes,
    unified_diff,
)

OLD = "line one\nline two\nline three"
NEW = "line one\nline two changed\nline three\nline four"


def test_unified_diff_reports_both_sides():
    lines = unified_diff(OLD, NEW, from_label="old", to_label="new")
    joined = "\n".join(lines)
    assert "--- old" in joined
    assert "+++ new" in joined
    assert "-line two" in joined
    assert "+line two changed" in joined
    assert "+line four" in joined


def test_counts_exclude_file_headers():
    lines = unified_diff(OLD, NEW, from_label="old", to_label="new")
    added, removed = count_changes(lines)
    assert added == 2
    assert removed == 1


def test_changed_lines_strips_markers():
    lines = unified_diff(OLD, NEW, from_label="old", to_label="new")
    added, removed = changed_lines(lines)
    assert "line two changed" in added
    assert "line four" in added
    assert "line two" in removed


def test_classification_labels():
    assert classify("This is a breaking change: the v1 field was removed.") == ("breaking",)
    assert classify("The `queue` helper is deprecated.") == ("deprecation",)
    assert classify("Fixes CVE-2026-1234.") == ("security",)
    assert classify("The Pro plan now costs $49 per month.") == ("pricing",)
    assert classify("Introducing a new `stream` option.") == ("addition",)
    assert classify("Whitespace only tweak.") == ()
    assert classify("") == ()


def test_classification_order_is_deterministic():
    text = "Breaking change, now deprecated, fixes CVE-2026-1, new price of $9, and a new field."
    labels = classify(text)
    assert labels == ("breaking", "deprecation", "security", "pricing", "addition")
    # Same input, same order — every time.
    assert labels == classify(text)
    assert tuple(sorted(labels, key=CLASSIFICATION_ORDER.index)) == labels


def test_build_summary_marks_breaking():
    summary = build_drift_summary(
        "GET /v1/run is supported.",
        "GET /v1/run is no longer supported.",
        from_label="before",
        to_label="after",
    )
    assert summary.added == 1
    assert summary.removed == 1
    assert summary.is_breaking
    assert not summary.truncated


def test_build_summary_is_empty_when_nothing_changed():
    summary = build_drift_summary(OLD, OLD, from_label="a", to_label="b")
    assert summary.diff == ""
    assert summary.added == 0
    assert summary.removed == 0
    assert summary.labels == ()
    assert not summary.is_breaking


def test_long_diff_is_truncated_with_a_note():
    old = "\n".join(f"line {index}" for index in range(200))
    new = "\n".join(f"changed {index}" for index in range(200))
    summary = build_drift_summary(old, new, max_diff_lines=10, from_label="a", to_label="b")
    assert summary.truncated
    assert "diff truncated at 10" in summary.diff
    assert len(summary.diff.split("\n")) == 11
