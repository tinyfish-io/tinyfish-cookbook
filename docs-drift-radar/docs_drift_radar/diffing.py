"""Diffing and change classification.

`unified_diff` is stdlib `difflib`. Classification is keyword heuristics over the
changed lines only, ordered deterministically so two runs over the same input always
produce the same label list — a report that reshuffles itself between runs is not
something you can diff.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass

# Order matters: this is the order labels appear in reports.
CLASSIFICATION_ORDER: tuple[str, ...] = (
    "breaking",
    "deprecation",
    "security",
    "pricing",
    "addition",
)

CLASSIFICATION_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "breaking",
        re.compile(
            r"\b(?:breaking changes?|backwards?[-\s]incompatible|no longer (?:supported|available|works?"
            r"|returns?|accepts?)|has been removed|have been removed|removed in v?\d"
            r"|is deprecated and will be removed|must (?:now )?(?:migrate|upgrade))\b",
            re.IGNORECASE,
        ),
    ),
    (
        "deprecation",
        re.compile(r"\b(?:deprecat\w*|sunset\w*|end[-\s]of[-\s]life|eol)\b", re.IGNORECASE),
    ),
    (
        "security",
        re.compile(
            r"\b(?:cve-\d{4}-\d+|vulnerabilit(?:y|ies)|security (?:fix|advisory|patch|update)|exploit)",
            re.IGNORECASE,
        ),
    ),
    (
        "pricing",
        re.compile(
            r"(?:[$€£¥]\s?\d|\bper (?:month|seat|user|request|token)\b|\bprice (?:increase|change|drop)\b"
            r"|\bnew pricing\b|\bnow costs?\b)",
            re.IGNORECASE,
        ),
    ),
    (
        "addition",
        re.compile(
            r"\b(?:new|introduc(?:es|ing)|added|now supports?|now accepts?|available (?:now|in))\b",
            re.IGNORECASE,
        ),
    ),
)

_ADDED_LINE_RE = re.compile(r"^\+(?!\+\+)")
_REMOVED_LINE_RE = re.compile(r"^-(?!--)")


@dataclass(frozen=True)
class DriftSummary:
    """What changed between two snapshots of one page."""

    added: int
    removed: int
    labels: tuple[str, ...]
    diff: str
    truncated: bool = False

    @property
    def is_breaking(self) -> bool:
        return "breaking" in self.labels


def unified_diff(
    old: str,
    new: str,
    *,
    from_label: str,
    to_label: str,
    context: int = 3,
) -> list[str]:
    """Line diff of two normalized documents."""

    return list(
        difflib.unified_diff(
            old.split("\n"),
            new.split("\n"),
            fromfile=from_label,
            tofile=to_label,
            lineterm="",
            n=context,
        )
    )


def changed_lines(diff_lines: list[str]) -> tuple[list[str], list[str]]:
    """Split a unified diff into added and removed content lines (markers stripped)."""

    added: list[str] = []
    removed: list[str] = []
    for line in diff_lines:
        if _ADDED_LINE_RE.match(line):
            added.append(line[1:])
        elif _REMOVED_LINE_RE.match(line):
            removed.append(line[1:])
    return added, removed


def classify(changed_text: str) -> tuple[str, ...]:
    """Keyword-classify changed text, always in `CLASSIFICATION_ORDER` order."""

    if not changed_text:
        return ()
    matched = {label for label, pattern in CLASSIFICATION_RULES if pattern.search(changed_text)}
    return tuple(label for label in CLASSIFICATION_ORDER if label in matched)


def count_changes(diff_lines: list[str]) -> tuple[int, int]:
    """(added, removed) content-line counts."""

    added, removed = changed_lines(diff_lines)
    return len(added), len(removed)


def build_drift_summary(
    old: str,
    new: str,
    *,
    from_label: str = "previous",
    to_label: str = "current",
    max_diff_lines: int = 400,
) -> DriftSummary:
    """Full drift summary: counts, labels, and the diff (bounded in size)."""

    diff_lines = unified_diff(old, new, from_label=from_label, to_label=to_label)
    if not diff_lines:
        return DriftSummary(added=0, removed=0, labels=(), diff="")

    added_lines, removed_lines = changed_lines(diff_lines)
    labels = classify("\n".join([*removed_lines, *added_lines]))

    truncated = len(diff_lines) > max_diff_lines
    if truncated:
        kept = diff_lines[:max_diff_lines]
        kept.append(f"... diff truncated at {max_diff_lines} of {len(diff_lines)} lines")
        diff_text = "\n".join(kept)
    else:
        diff_text = "\n".join(diff_lines)

    return DriftSummary(
        added=len(added_lines),
        removed=len(removed_lines),
        labels=labels,
        diff=diff_text,
        truncated=truncated,
    )
