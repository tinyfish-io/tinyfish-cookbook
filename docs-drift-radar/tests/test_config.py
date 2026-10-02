"""Settings and watchlist tests."""

import json

from docs_drift_radar.config import (
    DEFAULT_CONCURRENCY,
    load_settings,
    load_sources,
    slugify,
)


def test_slugify_is_readable_and_stable():
    assert (
        slugify("https://docs.tinyfish.ai/key-concepts/endpoints")
        == "docs-tinyfish-ai-key-concepts-endpoints"
    )
    assert slugify("https://www.example.com/a/b?utm_source=x#frag") == "example-com-a-b"
    assert slugify("HTTPS://EXAMPLE.COM/Path") == "example-com-path"
    # Always something usable, even for input with no slug-able characters.
    assert slugify("---") == "source"


def test_slugify_truncates_without_a_trailing_dash():
    slug = slugify("https://example.com/" + "segment-" * 20)
    assert len(slug) <= 60
    assert not slug.endswith("-")


def test_load_sources_accepts_mappings_and_bare_urls(tmp_path):
    config = tmp_path / "sources.yaml"
    config.write_text(
        """
sources:
  - label: Docs
    url: https://docs.example.com
  - https://blog.example.com
  - label: No slug, derived
    url: https://api.example.com/v1
    slug: custom-slug
""",
        encoding="utf-8",
    )

    specs = load_sources(config)
    assert [spec.slug for spec in specs] == ["docs-example-com", "blog-example-com", "custom-slug"]
    assert specs[0].label == "Docs"
    # A bare URL becomes its own label.
    assert specs[1].label == "https://blog.example.com"
    assert specs[2].url == "https://api.example.com/v1"


def test_load_sources_dedupes_colliding_slugs(tmp_path):
    config = tmp_path / "sources.json"
    config.write_text(
        json.dumps([{"url": "https://docs.example.com"}, {"url": "https://docs.example.com"}]),
        encoding="utf-8",
    )

    specs = load_sources(config)
    assert [spec.slug for spec in specs] == ["docs-example-com", "docs-example-com-2"]


def test_load_sources_skips_entries_without_a_url(tmp_path):
    config = tmp_path / "sources.yaml"
    config.write_text(
        "sources:\n  - label: broken\n  - url: https://ok.example.com\n",
        encoding="utf-8",
    )
    assert [spec.url for spec in load_sources(config)] == ["https://ok.example.com"]


def test_load_sources_handles_an_empty_file(tmp_path):
    config = tmp_path / "sources.yaml"
    config.write_text("", encoding="utf-8")
    assert load_sources(config) == []


def test_load_settings_defaults(monkeypatch, tmp_path):
    for name in (
        "DOCS_DRIFT_DB",
        "DOCS_DRIFT_CONFIG",
        "DOCS_DRIFT_CONCURRENCY",
        "DOCS_DRIFT_TIMEOUT_SECONDS",
        "TINYFISH_API_KEY",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = load_settings()
    assert settings.concurrency == DEFAULT_CONCURRENCY
    assert settings.api_key is None
    assert settings.db_path.name == "docs_drift_radar.db"


def test_load_settings_prefers_arguments_then_env(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCS_DRIFT_DB", str(tmp_path / "from-env.db"))
    monkeypatch.setenv("DOCS_DRIFT_CONCURRENCY", "9")
    monkeypatch.setenv("TINYFISH_API_KEY", "tf_test_key")

    settings = load_settings()
    assert settings.db_path == tmp_path / "from-env.db"
    assert settings.concurrency == 9
    assert settings.api_key == "tf_test_key"

    explicit = load_settings(db=tmp_path / "explicit.db", config=tmp_path / "sources.json")
    assert explicit.db_path == tmp_path / "explicit.db"
    assert explicit.config_path == tmp_path / "sources.json"


def test_invalid_numeric_env_falls_back_to_defaults(monkeypatch):
    monkeypatch.setenv("DOCS_DRIFT_CONCURRENCY", "zero")
    monkeypatch.setenv("DOCS_DRIFT_TIMEOUT_SECONDS", "-3")
    settings = load_settings()
    assert settings.concurrency == DEFAULT_CONCURRENCY
    assert settings.timeout_seconds > 0
