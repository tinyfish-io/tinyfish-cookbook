"""Runtime settings and the watchlist loader.

Everything is environment-driven with sane defaults so the CLI works with zero
configuration beyond `TINYFISH_API_KEY`.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

DEFAULT_DB_FILENAME = "docs_drift_radar.db"
DEFAULT_CONFIG_FILENAME = "sources.yaml"
DEFAULT_TIMEOUT_SECONDS = 45.0
DEFAULT_CONCURRENCY = 5
DEFAULT_MAX_RETRIES = 2

MAX_SLUG_LENGTH = 60

_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://")
_NON_SLUG_RE = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class Settings:
    """Resolved configuration for one CLI run or one API process."""

    api_key: str | None
    db_path: Path
    config_path: Path
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    concurrency: int = DEFAULT_CONCURRENCY
    max_retries: int = DEFAULT_MAX_RETRIES


@dataclass(frozen=True)
class SourceSpec:
    """One watched URL."""

    slug: str
    url: str
    label: str


def slugify(url: str) -> str:
    """Derive a stable, readable slug from a URL.

    `https://docs.tinyfish.ai/key-concepts/endpoints` -> `docs-tinyfish-ai-key-concepts-endpoints`
    """
    stripped = _SCHEME_RE.sub("", url.strip())
    stripped = stripped.split("?", 1)[0].split("#", 1)[0]
    stripped = stripped.lower().removeprefix("www.")
    slug = _NON_SLUG_RE.sub("-", stripped).strip("-")
    if len(slug) > MAX_SLUG_LENGTH:
        slug = slug[:MAX_SLUG_LENGTH].rstrip("-")
    return slug or "source"


def _positive_int(raw: str | None, default: int) -> int:
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def _positive_float(raw: str | None, default: float) -> float:
    if raw is None or not raw.strip():
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def load_settings(*, db: str | Path | None = None, config: str | Path | None = None) -> Settings:
    """Resolve settings from explicit arguments, then env vars, then defaults."""

    db_path = Path(db or os.getenv("DOCS_DRIFT_DB") or DEFAULT_DB_FILENAME)
    config_path = Path(config or os.getenv("DOCS_DRIFT_CONFIG") or DEFAULT_CONFIG_FILENAME)
    return Settings(
        api_key=os.getenv("TINYFISH_API_KEY") or None,
        db_path=db_path,
        config_path=config_path,
        timeout_seconds=_positive_float(os.getenv("DOCS_DRIFT_TIMEOUT_SECONDS"), DEFAULT_TIMEOUT_SECONDS),
        concurrency=_positive_int(os.getenv("DOCS_DRIFT_CONCURRENCY"), DEFAULT_CONCURRENCY),
        max_retries=_positive_int(os.getenv("DOCS_DRIFT_MAX_RETRIES"), DEFAULT_MAX_RETRIES),
    )


def load_sources(path: str | Path) -> list[SourceSpec]:
    """Read a watchlist from YAML or JSON.

    Accepts either a mapping with a `sources:` list or a bare list, and each entry
    may be a plain URL string or a mapping with `url`/`label`/`slug`. Duplicate
    slugs get a numeric suffix rather than silently overwriting each other.
    """

    config_path = Path(path)
    if not config_path.exists():
        raise FileNotFoundError(f"watchlist not found: {config_path}")

    raw = config_path.read_text(encoding="utf-8")
    if config_path.suffix.lower() == ".json":
        data = json.loads(raw) if raw.strip() else {}
    else:
        data = yaml.safe_load(raw) or {}

    entries = data.get("sources") if isinstance(data, dict) else data
    if not entries:
        return []
    if not isinstance(entries, list):
        raise ValueError(f"{config_path}: expected a list of sources")

    specs: list[SourceSpec] = []
    used: dict[str, int] = {}

    for entry in entries:
        if isinstance(entry, str):
            url, label, explicit_slug = entry, None, None
        elif isinstance(entry, dict):
            url = entry.get("url")
            label = entry.get("label")
            explicit_slug = entry.get("slug")
        else:
            continue

        if not url or not isinstance(url, str):
            continue

        url = url.strip()
        slug = (explicit_slug or slugify(url)).strip()

        seen = used.get(slug, 0)
        used[slug] = seen + 1
        if seen:
            slug = f"{slug}-{seen + 1}"

        specs.append(SourceSpec(slug=slug, url=url, label=(label or url).strip()))

    return specs
