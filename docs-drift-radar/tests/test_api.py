"""API tests — the HTTP contract, driven through Starlette's TestClient.

The module is imported fresh per test with `DOCS_DRIFT_*` pointing at `tmp_path`, so
nothing here touches a developer's real database. `settings` is then replaced with an
explicit one, which keeps the assertions deterministic even if a local `.env` happens
to hold a real key.
"""

import importlib
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def api(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCS_DRIFT_DB", str(tmp_path / "radar.db"))
    monkeypatch.setenv("DOCS_DRIFT_CONFIG", str(tmp_path / "sources.yaml"))

    module = importlib.reload(importlib.import_module("docs_drift_radar.api"))
    module._store = None
    module.settings = replace(module.settings, api_key=None)
    return module


@pytest.fixture()
def client(api):
    with TestClient(api.app) as test_client:
        yield test_client


def test_health_reports_state(client, api):
    health = client.get("/api/health").json()
    assert health["status"] == "ok"
    assert health["sources"] == 0
    assert health["drifts"] == 0
    assert health["api_key_configured"] is False
    assert health["version"] == api.__version__


def test_event_contract_is_published(client, api):
    contract = client.get("/api/events").json()
    assert contract["events"] == [
        "source_start",
        "source_complete",
        "source_error",
        "scan_complete",
    ]
    assert contract["outcomes"] == ["first_seen", "unchanged", "changed", "error"]
    # Every event the dashboard can receive is described, so the contract is complete.
    assert set(contract["descriptions"]) == set(contract["events"])


def test_dashboard_is_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Docs Drift Radar" in response.text


def test_source_crud(client):
    assert client.get("/api/sources").json() == {"sources": []}

    created = client.post("/api/sources", json={"url": "https://docs.example.com"})
    assert created.status_code == 201
    source = created.json()["source"]
    assert source["slug"] == "docs-example-com"
    assert source["label"] == "https://docs.example.com"

    listed = client.get("/api/sources").json()["sources"]
    assert [row["slug"] for row in listed] == ["docs-example-com"]
    assert listed[0]["snapshot_count"] == 0

    assert client.delete("/api/sources/docs-example-com").status_code == 200
    assert client.delete("/api/sources/docs-example-com").status_code == 404
    assert client.get("/api/sources").json() == {"sources": []}


def test_source_url_validation(client):
    response = client.post("/api/sources", json={"url": "ftp://example.com"})
    assert response.status_code == 400
    assert "http://" in response.json()["detail"]

    too_short = client.post("/api/sources", json={"url": "http://"})
    assert too_short.status_code == 422


def test_scan_rejects_empty_store_and_missing_key(client, api):
    # No sources yet.
    assert client.post("/api/scan", json={}).status_code == 409

    client.post("/api/sources", json={"url": "https://docs.example.com"})

    # Sources exist, but the key does not.
    response = client.post("/api/scan", json={})
    assert response.status_code == 503
    assert "TINYFISH_API_KEY" in response.json()["detail"]

    # Unknown slug is a 404 rather than a silent no-op scan.
    api.settings = replace(api.settings, api_key="tf_test")
    assert client.post("/api/scan", json={"slug": "nope"}).status_code == 404


def test_report_and_drifts_are_empty_but_valid(client):
    assert client.get("/api/drifts").json() == {"count": 0, "drifts": []}

    payload = client.get("/api/report").json()
    assert payload["totals"] == {"drifts": 0, "sources": 0, "breaking": 0}
    assert payload["drifts"] == []

    markdown = client.get("/api/report?format=md")
    assert markdown.status_code == 200
    assert markdown.headers["content-type"].startswith("text/plain")
    assert "No drift recorded in this window." in markdown.text

    assert client.get("/api/report?format=bogus").status_code == 400


def test_drifts_endpoint_renders_stored_history(client, api):
    """The full store -> API -> JSON path, including label decoration."""

    store = api.get_store()
    store.upsert_source("docs-example-com", "https://docs.example.com", "Docs")
    snapshot_id = store.insert_snapshot(
        "docs-example-com",
        content="GET /v1/run",
        content_hash="hash-after",
        char_count=10,
        line_count=1,
        title="Docs",
    )
    store.insert_drift(
        "docs-example-com",
        to_snapshot=snapshot_id,
        from_snapshot=None,
        added=1,
        removed=1,
        classification=("breaking", "addition"),
        diff="--- a\n+++ b\n-GET /v1/run\n+GET /v2/run",
        detected_at="2026-09-01T00:00:00+00:00",
    )

    payload = client.get("/api/drifts").json()
    assert payload["count"] == 1
    drift = payload["drifts"][0]
    assert drift["slug"] == "docs-example-com"
    assert drift["label"] == "Docs"
    assert drift["url"] == "https://docs.example.com"
    assert drift["labels"] == ["breaking", "addition"]
    assert drift["is_breaking"] is True
    assert "+GET /v2/run" in drift["diff"]

    markdown = client.get("/api/report?format=md").text
    assert "## docs-example-com" in markdown
    assert "`breaking` `addition`" in markdown

    assert client.get("/api/drifts?slug=other").json()["count"] == 0
    assert client.get("/api/drifts?since=2026-10-01T00:00:00+00:00").json()["count"] == 0

    # Source counters reflect the recorded history.
    assert client.get("/api/sources").json()["sources"][0]["drift_count"] == 1
