"""Store tests — schema, filtering, and cascade behaviour."""

from docs_drift_radar.store import Store, parse_classification


def _store(tmp_path) -> Store:
    return Store(tmp_path / "radar.db")


def test_upsert_is_idempotent_and_preserves_history(tmp_path):
    store = _store(tmp_path)
    store.upsert_source("docs", "https://docs.example.com", "Docs")
    snapshot_id = store.insert_snapshot(
        "docs",
        content="# A",
        content_hash="hash-a",
        char_count=3,
        line_count=1,
        title="A",
    )
    store.insert_drift(
        "docs",
        to_snapshot=snapshot_id,
        from_snapshot=None,
        added=1,
        removed=0,
        classification=("addition",),
        diff="+ # A",
    )

    # Re-adding the same slug refreshes the label and keeps snapshots/drifts.
    store.upsert_source("docs", "https://docs.example.com/v2", "Docs v2")
    source = store.get_source("docs")
    assert source is not None
    assert source["url"] == "https://docs.example.com/v2"
    assert source["label"] == "Docs v2"

    row = store.list_sources()[0]
    assert row["snapshot_count"] == 1
    assert row["drift_count"] == 1


def test_snapshot_ordering(tmp_path):
    store = _store(tmp_path)
    store.upsert_source("docs", "https://docs.example.com", "Docs")

    first = store.insert_snapshot(
        "docs", content="one", content_hash="h1", char_count=3, line_count=1
    )
    second = store.insert_snapshot(
        "docs", content="two", content_hash="h2", char_count=3, line_count=1
    )

    latest = store.latest_snapshot("docs")
    assert latest is not None and latest["id"] == second
    assert [snapshot["id"] for snapshot in store.recent_snapshots("docs", limit=2)] == [
        second,
        first,
    ]
    assert store.get_snapshot(first)["content"] == "one"


def test_drift_filters_and_decoration(tmp_path):
    store = _store(tmp_path)
    store.upsert_source("docs", "https://docs.example.com", "Docs")
    store.upsert_source("blog", "https://blog.example.com", "Blog")

    for slug in ("docs", "blog"):
        snapshot_id = store.insert_snapshot(
            slug, content="x", content_hash=f"h-{slug}", char_count=1, line_count=1
        )
        store.insert_drift(
            slug,
            to_snapshot=snapshot_id,
            from_snapshot=None,
            added=2,
            removed=1,
            classification=("breaking", "pricing") if slug == "docs" else (),
            diff="+ a\n- b",
            detected_at="2026-05-01T00:00:00+00:00",
        )

    everything = store.list_drifts(limit=10)
    assert len(everything) == 2

    docs_only = store.list_drifts(limit=10, slug="docs")
    assert len(docs_only) == 1
    assert docs_only[0]["label"] == "Docs"
    assert docs_only[0]["url"] == "https://docs.example.com"
    assert docs_only[0]["labels"] == ["breaking", "pricing"]
    assert docs_only[0]["is_breaking"] is True

    assert store.list_drifts(limit=10, since="2026-06-01T00:00:00+00:00") == []
    assert len(store.list_drifts(limit=10, since="2026-01-01T00:00:00+00:00")) == 2


def test_delete_source_cascades(tmp_path):
    store = _store(tmp_path)
    store.upsert_source("docs", "https://docs.example.com", "Docs")
    snapshot_id = store.insert_snapshot(
        "docs", content="x", content_hash="h", char_count=1, line_count=1
    )
    store.insert_drift(
        "docs",
        to_snapshot=snapshot_id,
        from_snapshot=None,
        added=1,
        removed=0,
        classification=("addition",),
        diff="+ x",
    )

    assert store.delete_source("docs") is True
    assert store.delete_source("docs") is False
    assert store.list_sources() == []
    assert store.list_drifts(limit=10) == []
    assert store.latest_snapshot("docs") is None


def test_parse_classification():
    assert parse_classification("breaking,pricing") == ("breaking", "pricing")
    assert parse_classification("") == ()
    assert parse_classification(" breaking , ") == ("breaking",)
