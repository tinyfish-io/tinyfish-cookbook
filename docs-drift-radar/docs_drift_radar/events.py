"""Single source of truth for the scan progress event names.

Client and server must never disagree about these strings. The dashboard does not
hard-code them either: it reads `GET /api/events` at boot and warns in the console
when it receives a type it was not told about. That removes the failure mode where
a route silently stops emitting an event some client still waits for.
"""

from __future__ import annotations

SOURCE_START = "source_start"
SOURCE_COMPLETE = "source_complete"
SOURCE_ERROR = "source_error"
SCAN_COMPLETE = "scan_complete"

# Emitted by /api/scan while a scan is running.
SCAN_EVENTS: tuple[str, ...] = (
    SOURCE_START,
    SOURCE_COMPLETE,
    SOURCE_ERROR,
    SCAN_COMPLETE,
)

# Per-source terminal states, used by the CLI and the dashboard.
OUTCOME_FIRST_SEEN = "first_seen"
OUTCOME_UNCHANGED = "unchanged"
OUTCOME_CHANGED = "changed"
OUTCOME_ERROR = "error"

OUTCOMES: tuple[str, ...] = (
    OUTCOME_FIRST_SEEN,
    OUTCOME_UNCHANGED,
    OUTCOME_CHANGED,
    OUTCOME_ERROR,
)

# Statuses that mean "this URL was not successfully read this run".
NON_SUCCESS_OUTCOMES: frozenset[str] = frozenset({OUTCOME_ERROR})
