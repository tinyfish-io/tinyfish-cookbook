"""Scan orchestration: fetch every watched URL, snapshot it, and record drifts.

A failure on one source never aborts the run — each URL resolves to a `ScanOutcome`,
so a broken page shows up as one red row in the report instead of killing the cron job.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Sequence

from . import events
from .config import SourceSpec
from .diffing import build_drift_summary
from .normalize import fingerprint, normalize_markdown
from .store import Store, utc_now

logger = logging.getLogger(__name__)

# Callback used by the API to stream progress over SSE. Optional everywhere else.
EmitFn = Callable[[dict[str, Any]], Awaitable[None]]


@dataclass(frozen=True)
class ScanOutcome:
    """What happened to one source during a scan."""

    slug: str
    url: str
    label: str
    status: str
    added: int = 0
    removed: int = 0
    labels: tuple[str, ...] = ()
    snapshot_id: int | None = None
    drift_id: int | None = None
    title: str | None = None
    error: str | None = None
    diff: str = ""

    @property
    def is_breaking(self) -> bool:
        return "breaking" in self.labels

    def as_event(self) -> dict[str, Any]:
        """Progress payload. Deliberately omits `diff` — a diff is not a heartbeat."""

        return {
            "type": (
                events.SOURCE_ERROR
                if self.status == events.OUTCOME_ERROR
                else events.SOURCE_COMPLETE
            ),
            "slug": self.slug,
            "url": self.url,
            "label": self.label,
            "status": self.status,
            "added": self.added,
            "removed": self.removed,
            "labels": list(self.labels),
            "title": self.title,
            "error": self.error,
        }


async def scan_source(source: SourceSpec, *, fetcher: Any, store: Store) -> ScanOutcome:
    """Fetch, normalize, and compare one source against its last snapshot."""

    base = {"slug": source.slug, "url": source.url, "label": source.label}

    result = await fetcher.fetch(source.url)
    if not result.ok:
        return ScanOutcome(
            **base, status=events.OUTCOME_ERROR, error=result.error or "fetch failed"
        )

    normalized = normalize_markdown(result.text)
    if not normalized.strip():
        # Never overwrite a good snapshot with an empty render (consent walls, 200 with
        # an error body, a page that moved behind a login). Treat it as a failed read.
        return ScanOutcome(
            **base,
            status=events.OUTCOME_ERROR,
            error="page produced no content after normalization",
        )

    marks = fingerprint(normalized)
    title = marks["title"] if isinstance(marks["title"], str) else None
    previous = store.latest_snapshot(source.slug)

    if previous is None:
        snapshot_id = store.insert_snapshot(
            source.slug,
            content=normalized,
            content_hash=str(marks["content_hash"]),
            char_count=int(marks["char_count"] or 0),
            line_count=int(marks["line_count"] or 0),
            title=title,
        )
        return ScanOutcome(
            **base,
            status=events.OUTCOME_FIRST_SEEN,
            snapshot_id=snapshot_id,
            title=title,
        )

    if previous["content_hash"] == marks["content_hash"]:
        return ScanOutcome(
            **base,
            status=events.OUTCOME_UNCHANGED,
            snapshot_id=int(previous["id"]),
            title=previous.get("title"),
        )

    summary = build_drift_summary(
        previous["content"],
        normalized,
        from_label=f"{source.slug}@{previous['fetched_at']}",
        to_label=f"{source.slug}@{utc_now()}",
    )

    snapshot_id = store.insert_snapshot(
        source.slug,
        content=normalized,
        content_hash=str(marks["content_hash"]),
        char_count=int(marks["char_count"] or 0),
        line_count=int(marks["line_count"] or 0),
        title=title,
    )
    drift_id = store.insert_drift(
        source.slug,
        to_snapshot=snapshot_id,
        from_snapshot=int(previous["id"]),
        added=summary.added,
        removed=summary.removed,
        classification=summary.labels,
        diff=summary.diff,
    )

    return ScanOutcome(
        **base,
        status=events.OUTCOME_CHANGED,
        added=summary.added,
        removed=summary.removed,
        labels=summary.labels,
        snapshot_id=snapshot_id,
        drift_id=drift_id,
        title=title,
        diff=summary.diff,
    )


async def scan_all(
    sources: Sequence[SourceSpec],
    *,
    fetcher: Any,
    store: Store,
    concurrency: int = 5,
    emit: EmitFn | None = None,
) -> list[ScanOutcome]:
    """Scan every source in parallel, bounded by `concurrency`, order preserved."""

    semaphore = asyncio.Semaphore(max(1, int(concurrency)))

    async def run(source: SourceSpec) -> ScanOutcome:
        async with semaphore:
            if emit is not None:
                await emit(
                    {
                        "type": events.SOURCE_START,
                        "slug": source.slug,
                        "url": source.url,
                        "label": source.label,
                    }
                )
            try:
                outcome = await scan_source(source, fetcher=fetcher, store=store)
            except Exception as exc:  # noqa: BLE001 — one bad source must not stop the scan
                logger.exception("scan crashed for %s", source.slug)
                outcome = ScanOutcome(
                    slug=source.slug,
                    url=source.url,
                    label=source.label,
                    status=events.OUTCOME_ERROR,
                    error=f"{type(exc).__name__}: {exc}",
                )
            if emit is not None:
                await emit(outcome.as_event())
            return outcome

    if not sources:
        return []
    return list(await asyncio.gather(*(run(source) for source in sources)))


def any_breaking(outcomes: Sequence[ScanOutcome]) -> bool:
    """True when at least one source reported a breaking change."""

    return any(outcome.is_breaking for outcome in outcomes)
