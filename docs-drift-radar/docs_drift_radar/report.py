"""Report rendering — markdown for humans, JSON for whatever consumes it next."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

MAX_DIFF_LINES = 60


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _badges(labels: Sequence[str]) -> str:
    return " ".join(f"`{label}`" for label in labels) if labels else "_unclassified_"


def summarize(drifts: Sequence[dict[str, Any]]) -> dict[str, int]:
    """Totals used in both the markdown header and the JSON envelope."""

    return {
        "drifts": len(drifts),
        "sources": len({drift.get("slug") for drift in drifts}),
        "breaking": sum(1 for drift in drifts if drift.get("is_breaking")),
    }


def _truncated_diff(diff: str, max_diff_lines: int) -> str:
    lines = (diff or "").split("\n")
    if len(lines) <= max_diff_lines:
        return diff or ""
    kept = lines[:max_diff_lines]
    kept.append(f"... diff truncated at {max_diff_lines} of {len(lines)} lines")
    return "\n".join(kept)


def render_markdown(
    drifts: Sequence[dict[str, Any]],
    *,
    since: str | None = None,
    max_diff_lines: int = MAX_DIFF_LINES,
    generated_at: str | None = None,
) -> str:
    """Human-readable drift report."""

    generated = generated_at or _now()
    totals = summarize(drifts)
    window = f" (since {since})" if since else ""

    lines = [
        "# Docs Drift Radar",
        "",
        (
            f"Generated {generated}{window} · **{totals['drifts']} drift(s)** across "
            f"**{totals['sources']} source(s)** · **{totals['breaking']} breaking**"
        ),
        "",
    ]

    if not drifts:
        lines.extend(
            [
                "No drift recorded in this window.",
                "",
                "Run `python -m docs_drift_radar scan` to take fresh snapshots, or wait for "
                "the next scheduled run.",
                "",
            ]
        )
        return "\n".join(lines)

    for drift in drifts:
        lines.extend(
            [
                f"## {drift.get('slug')}",
                "",
                f"- **Source:** {drift.get('label') or drift.get('slug')}",
                f"- **URL:** {drift.get('url')}",
                f"- **Detected:** {drift.get('detected_at')}",
                f"- **Changed:** +{drift.get('added', 0)} / −{drift.get('removed', 0)} lines",
                f"- **Classified:** {_badges(list(drift.get('labels') or []))}",
                "",
                "```diff",
                _truncated_diff(drift.get("diff") or "", max_diff_lines),
                "```",
                "",
            ]
        )

    return "\n".join(lines)


def render_json(
    drifts: Sequence[dict[str, Any]],
    *,
    since: str | None = None,
    generated_at: str | None = None,
) -> dict[str, Any]:
    """Machine-readable report. Keeps the diff, unlike the SSE progress events."""

    totals = summarize(drifts)
    return {
        "generated_at": generated_at or _now(),
        "since": since,
        "totals": totals,
        "drifts": [
            {
                "slug": drift.get("slug"),
                "label": drift.get("label"),
                "url": drift.get("url"),
                "detected_at": drift.get("detected_at"),
                "added": drift.get("added", 0),
                "removed": drift.get("removed", 0),
                "labels": list(drift.get("labels") or []),
                "is_breaking": bool(drift.get("is_breaking")),
                "diff": drift.get("diff") or "",
            }
            for drift in drifts
        ],
    }


def render_outcomes(outcomes: Iterable[Any]) -> str:
    """One-line-per-source scan summary, used by the CLI."""

    rows: list[str] = []
    for outcome in outcomes:
        detail = outcome.error or ""
        if outcome.status == "changed":
            detail = f"+{outcome.added}/−{outcome.removed} {','.join(outcome.labels) or 'unclassified'}"
        elif outcome.status in ("first_seen", "unchanged"):
            detail = outcome.title or ""
        rows.append(f"{outcome.status:<11} {outcome.slug:<40} {detail}".rstrip())
    return "\n".join(rows)
