"""SQLite persistence for sources, snapshots, and detected drifts.

Standard library only (`sqlite3`) — the dataset here is small and the recipe is meant
to be copied into a cron job or a container without extra infrastructure. A connection
is opened per call: `sqlite3` connections are not safe to share across threads and
FastAPI may run sync endpoints on a worker thread.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    slug        TEXT PRIMARY KEY,
    url         TEXT NOT NULL,
    label       TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    slug         TEXT NOT NULL REFERENCES sources(slug) ON DELETE CASCADE,
    fetched_at   TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content      TEXT NOT NULL,
    char_count   INTEGER NOT NULL,
    line_count   INTEGER NOT NULL,
    title        TEXT
);

CREATE TABLE IF NOT EXISTS drifts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slug           TEXT NOT NULL REFERENCES sources(slug) ON DELETE CASCADE,
    detected_at    TEXT NOT NULL,
    from_snapshot  INTEGER,
    to_snapshot    INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    added          INTEGER NOT NULL,
    removed        INTEGER NOT NULL,
    classification TEXT NOT NULL,
    diff           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_slug ON snapshots(slug, id DESC);
CREATE INDEX IF NOT EXISTS idx_drifts_slug ON drifts(slug, id DESC);
CREATE INDEX IF NOT EXISTS idx_drifts_detected_at ON drifts(detected_at DESC);
"""


def utc_now() -> str:
    """Second-precision UTC ISO-8601, so stored timestamps sort lexicographically."""

    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _as_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


class Store:
    """Thin repository over a single SQLite file."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        if self.path.parent and str(self.path.parent) not in ("", "."):
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _init_schema(self) -> None:
        with self._connect() as connection:
            connection.executescript(SCHEMA)

    # ---------------------------------------------------------------- sources

    def upsert_source(self, slug: str, url: str, label: str) -> dict[str, Any]:
        """Insert a source, or refresh its url/label while keeping its history."""

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO sources (slug, url, label, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(slug) DO UPDATE SET url = excluded.url, label = excluded.label
                """,
                (slug, url, label, utc_now()),
            )
        source = self.get_source(slug)
        assert source is not None  # just written
        return source

    def get_source(self, slug: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM sources WHERE slug = ?", (slug,)
            ).fetchone()
        return _as_dict(row)

    def list_sources(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT s.*,
                       (SELECT COUNT(*) FROM snapshots WHERE slug = s.slug) AS snapshot_count,
                       (SELECT COUNT(*) FROM drifts    WHERE slug = s.slug) AS drift_count
                FROM sources s
                ORDER BY s.slug
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def count_sources(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS n FROM sources").fetchone()
        return int(row["n"])

    def delete_source(self, slug: str) -> bool:
        """Remove a source and, by cascade, its snapshots and drifts."""

        with self._connect() as connection:
            cursor = connection.execute("DELETE FROM sources WHERE slug = ?", (slug,))
            return cursor.rowcount > 0

    # -------------------------------------------------------------- snapshots

    def latest_snapshot(self, slug: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM snapshots WHERE slug = ? ORDER BY id DESC LIMIT 1",
                (slug,),
            ).fetchone()
        return _as_dict(row)

    def recent_snapshots(self, slug: str, limit: int = 2) -> list[dict[str, Any]]:
        """Most recent snapshots, newest first."""

        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM snapshots WHERE slug = ? ORDER BY id DESC LIMIT ?",
                (slug, limit),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_snapshot(self, snapshot_id: int) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM snapshots WHERE id = ?", (snapshot_id,)
            ).fetchone()
        return _as_dict(row)

    def insert_snapshot(
        self,
        slug: str,
        *,
        content: str,
        content_hash: str,
        char_count: int,
        line_count: int,
        title: str | None = None,
        fetched_at: str | None = None,
    ) -> int:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO snapshots
                    (slug, fetched_at, content_hash, content, char_count, line_count, title)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    slug,
                    fetched_at or utc_now(),
                    content_hash,
                    content,
                    char_count,
                    line_count,
                    title,
                ),
            )
            return int(cursor.lastrowid or 0)

    # ----------------------------------------------------------------- drifts

    def insert_drift(
        self,
        slug: str,
        *,
        to_snapshot: int,
        from_snapshot: int | None,
        added: int,
        removed: int,
        classification: Sequence[str],
        diff: str,
        detected_at: str | None = None,
    ) -> int:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO drifts
                    (slug, detected_at, from_snapshot, to_snapshot, added, removed,
                     classification, diff)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    slug,
                    detected_at or utc_now(),
                    from_snapshot,
                    to_snapshot,
                    added,
                    removed,
                    ",".join(classification),
                    diff,
                ),
            )
            return int(cursor.lastrowid or 0)

    def list_drifts(
        self,
        *,
        limit: int = 50,
        slug: str | None = None,
        since: str | None = None,
    ) -> list[dict[str, Any]]:
        """Drifts newest-first, joined with the source's url/label for reporting."""

        clauses: list[str] = []
        params: list[Any] = []
        if slug:
            clauses.append("d.slug = ?")
            params.append(slug)
        if since:
            clauses.append("d.detected_at >= ?")
            params.append(since)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        params.append(max(1, limit))

        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT d.*, s.url AS url, s.label AS label
                FROM drifts d
                JOIN sources s ON s.slug = d.slug
                {where}
                ORDER BY d.id DESC
                LIMIT ?
                """,
                params,
            ).fetchall()
        return [_decorate(dict(row)) for row in rows]

    def labels_in(self, drifts: Iterable[dict[str, Any]]) -> list[str]:
        """Flatten the classification column of several drift rows."""

        labels: list[str] = []
        for drift in drifts:
            labels.extend(parse_classification(drift.get("classification") or ""))
        return labels


def parse_classification(raw: str) -> tuple[str, ...]:
    """`"breaking,pricing"` -> `("breaking", "pricing")`."""

    return tuple(part for part in (piece.strip() for piece in raw.split(",")) if part)


def _decorate(row: dict[str, Any]) -> dict[str, Any]:
    """Add derived fields the report and the dashboard both want."""

    row["labels"] = list(parse_classification(row.get("classification") or ""))
    row["is_breaking"] = "breaking" in row["labels"]
    return row
