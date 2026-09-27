"""CLI entry point: `python -m docs_drift_radar <command>`.

Exit codes are the contract for cron and CI:
  0 — scan completed, nothing classified as breaking
  1 — scan completed, at least one source reported a breaking change
  2 — the scan could not run at all (missing key, no sources, unexpected error)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Sequence

from dotenv import load_dotenv

from . import __version__, events
from .config import Settings, SourceSpec, load_settings, load_sources, slugify
from .diffing import changed_lines, classify, count_changes, unified_diff
from .report import render_json, render_markdown, render_outcomes
from .scanner import any_breaking, scan_all
from .store import Store
from .tinyfish_client import TinyFishFetcher

EXIT_OK = 0
EXIT_BREAKING = 1
EXIT_ERROR = 2

logger = logging.getLogger(__name__)


def _add_common(parser: argparse.ArgumentParser) -> argparse.ArgumentParser:
    parser.add_argument(
        "--db",
        default=None,
        help="SQLite path (default: $DOCS_DRIFT_DB or docs_drift_radar.db)",
    )
    parser.add_argument(
        "--config",
        default=None,
        help="watchlist used when seeding (default: $DOCS_DRIFT_CONFIG or sources.yaml)",
    )
    return parser


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    _add_common(common)

    parser = argparse.ArgumentParser(
        prog="docs-drift-radar",
        description=(
            "Watch documentation URLs with the TinyFish Fetch endpoint and report "
            "what changed since the last run."
        ),
    )
    parser.add_argument("--version", action="version", version=f"docs-drift-radar {__version__}")
    subparsers = parser.add_subparsers(dest="command", required=True)

    add = subparsers.add_parser("add", parents=[common], help="add or update a watched URL")
    add.add_argument("url")
    add.add_argument("--label", default=None, help="human name shown in reports")
    add.add_argument("--slug", default=None, help="override the derived slug")

    scan = subparsers.add_parser("scan", parents=[common], help="fetch and compare every source")
    scan.add_argument("--source", default=None, help="scan only this slug")
    scan.add_argument("--concurrency", type=int, default=None, help="parallel fetches")
    scan.add_argument("--json", action="store_true", help="emit outcomes as JSON")
    scan.add_argument(
        "--no-seed",
        action="store_true",
        help="do not seed from the watchlist when the store is empty",
    )

    report = subparsers.add_parser("report", parents=[common], help="print recorded drifts")
    report.add_argument("--format", choices=("md", "json"), default="md")
    report.add_argument("--limit", type=int, default=20)
    report.add_argument("--since", default=None, help="ISO-8601 timestamp lower bound")
    report.add_argument("--source", default=None, help="restrict to one slug")

    diff = subparsers.add_parser("diff", parents=[common], help="show a source's latest drift")
    diff.add_argument("slug")
    diff.add_argument("--context", type=int, default=3)

    subparsers.add_parser("sources", parents=[common], help="list watched sources")

    serve = subparsers.add_parser("serve", parents=[common], help="run the API and dashboard")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--reload", action="store_true")

    return parser


def seed_if_empty(store: Store, config_path: Path) -> int:
    """Load the watchlist when the store is empty. Returns the number seeded."""

    if store.count_sources():
        return 0
    try:
        specs = load_sources(config_path)
    except FileNotFoundError:
        logger.debug("no watchlist at %s", config_path)
        return 0
    for spec in specs:
        store.upsert_source(spec.slug, spec.url, spec.label)
    if specs:
        print(f"seeded {len(specs)} source(s) from {config_path}")
    return len(specs)


def build_fetcher(api_key: str | None, *, timeout: float, max_retries: int) -> TinyFishFetcher:
    """Construct the fetcher, translating SDK import errors into something actionable."""

    if not api_key:
        raise RuntimeError(
            "TINYFISH_API_KEY is not set. Get a free key at https://agent.tinyfish.ai/ "
            "then put it in .env (see .env.example)."
        )
    try:
        return TinyFishFetcher(api_key, timeout=timeout, max_retries=max_retries)
    except ImportError as exc:  # pragma: no cover - depends on the local venv
        raise RuntimeError(
            f"the tinyfish SDK is not installed ({exc}). Run: pip install -r requirements.txt"
        ) from exc


def cmd_add(args: argparse.Namespace, settings: Settings) -> int:
    store = Store(settings.db_path)
    url = args.url.strip()
    if not url.lower().startswith(("http://", "https://")):
        print("url must start with http:// or https://", file=sys.stderr)
        return EXIT_ERROR

    slug = (args.slug or slugify(url)).strip()
    source = store.upsert_source(slug, url, (args.label or url).strip())
    print(f"watching {source['slug']} -> {source['url']}")
    return EXIT_OK


def cmd_scan(args: argparse.Namespace, settings: Settings) -> int:
    store = Store(settings.db_path)
    if not args.no_seed:
        seed_if_empty(store, settings.config_path)

    rows = store.list_sources()
    if args.source:
        rows = [row for row in rows if row["slug"] == args.source]
        if not rows:
            print(f"unknown source: {args.source}", file=sys.stderr)
            return EXIT_ERROR
    if not rows:
        print(
            "nothing to scan — add a URL (`add <url>`) or create sources.yaml",
            file=sys.stderr,
        )
        return EXIT_ERROR

    specs = [SourceSpec(slug=row["slug"], url=row["url"], label=row["label"]) for row in rows]

    try:
        fetcher = build_fetcher(
            settings.api_key,
            timeout=settings.timeout_seconds,
            max_retries=settings.max_retries,
        )
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return EXIT_ERROR

    outcomes = asyncio.run(
        scan_all(
            specs,
            fetcher=fetcher,
            store=store,
            concurrency=args.concurrency or settings.concurrency,
        )
    )

    if args.json:
        print(json.dumps([asdict(outcome) for outcome in outcomes], indent=2, default=str))
    else:
        changed = sum(1 for o in outcomes if o.status == events.OUTCOME_CHANGED)
        failed = sum(1 for o in outcomes if o.status == events.OUTCOME_ERROR)
        print(render_outcomes(outcomes))
        print()
        print(f"{len(outcomes)} source(s) · {changed} changed · {failed} failed")

    if any_breaking(outcomes):
        print("breaking change(s) detected", file=sys.stderr)
        return EXIT_BREAKING
    return EXIT_OK


def cmd_report(args: argparse.Namespace, settings: Settings) -> int:
    store = Store(settings.db_path)
    drifts = store.list_drifts(limit=args.limit, slug=args.source, since=args.since)
    if args.format == "json":
        print(json.dumps(render_json(drifts, since=args.since), indent=2))
    else:
        print(render_markdown(drifts, since=args.since))
    return EXIT_OK


def cmd_diff(args: argparse.Namespace, settings: Settings) -> int:
    store = Store(settings.db_path)
    snapshots = store.recent_snapshots(args.slug, limit=2)

    if not snapshots:
        print(f"no snapshots for {args.slug} yet — run `scan` first", file=sys.stderr)
        return EXIT_ERROR
    if len(snapshots) == 1:
        print(f"only one snapshot for {args.slug}; nothing to diff yet")
        return EXIT_OK

    current, previous = snapshots[0], snapshots[1]
    diff_lines = unified_diff(
        previous["content"],
        current["content"],
        from_label=f"{args.slug}@{previous['fetched_at']}",
        to_label=f"{args.slug}@{current['fetched_at']}",
        context=args.context,
    )
    if not diff_lines:
        print(f"{args.slug}: no difference between the two most recent snapshots")
        return EXIT_OK

    added, removed = count_changes(diff_lines)
    added_lines, removed_lines = changed_lines(diff_lines)
    labels = classify("\n".join([*removed_lines, *added_lines]))

    print(f"{args.slug}: +{added} / -{removed} · {', '.join(labels) or 'unclassified'}")
    print()
    print("\n".join(diff_lines))
    return EXIT_OK


def cmd_sources(args: argparse.Namespace, settings: Settings) -> int:
    rows = Store(settings.db_path).list_sources()
    if not rows:
        print("no sources yet — run `add <url>` or `scan` to seed from sources.yaml")
        return EXIT_OK
    for row in rows:
        print(
            f"{row['slug']:<40} snapshots={row['snapshot_count']:<4} "
            f"drifts={row['drift_count']:<4} {row['url']}"
        )
    return EXIT_OK


def cmd_serve(args: argparse.Namespace, settings: Settings) -> int:
    import uvicorn

    if args.reload:
        # uvicorn needs an import string to be able to reload.
        uvicorn.run("docs_drift_radar.api:app", host=args.host, port=args.port, reload=True)
    else:
        from .api import app

        uvicorn.run(app, host=args.host, port=args.port)
    return EXIT_OK


HANDLERS = {
    "add": cmd_add,
    "scan": cmd_scan,
    "report": cmd_report,
    "diff": cmd_diff,
    "sources": cmd_sources,
    "serve": cmd_serve,
}


def main(argv: Sequence[str] | None = None) -> int:
    load_dotenv()
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

    settings = load_settings(db=args.db, config=args.config)
    try:
        return HANDLERS[args.command](args, settings)
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
        return EXIT_ERROR
    except Exception as exc:  # noqa: BLE001 — the CLI reports, it does not traceback
        logger.debug("command failed", exc_info=True)
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        return EXIT_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
