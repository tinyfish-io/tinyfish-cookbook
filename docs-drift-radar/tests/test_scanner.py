"""Scanner tests.

The fetcher is injected, so these run with no network and no API key. They pin the
state machine the whole recipe depends on: first_seen -> unchanged -> changed, plus
the rule that a failed read never destroys a good snapshot.
"""

import asyncio

from docs_drift_radar import events
from docs_drift_radar.config import SourceSpec
from docs_drift_radar.scanner import any_breaking, scan_all
from docs_drift_radar.store import Store
from docs_drift_radar.tinyfish_client import FetchResult

URL = "https://docs.example.com/endpoints"
SOURCE = SourceSpec(slug="docs-example-com-endpoints", url=URL, label="Docs endpoints")

STABLE = "# Endpoints\n\nGET /v1/run is supported.\n"
CHANGED = "# Endpoints\n\nGET /v1/run is no longer supported.\nGET /v1/queue is new.\n"


class StubFetcher:
    """Returns canned pages; records every call."""

    def __init__(
        self,
        pages: dict[str, str] | None = None,
        failures: dict[str, str] | None = None,
    ) -> None:
        self.pages = pages or {}
        self.failures = failures or {}
        self.calls: list[str] = []

    async def fetch(self, url: str) -> FetchResult:
        self.calls.append(url)
        if url in self.failures:
            return FetchResult(url=url, ok=False, error=self.failures[url])
        return FetchResult(url=url, ok=True, text=self.pages.get(url, ""))


def test_first_scan_records_a_baseline(tmp_path):
    store = Store(tmp_path / "radar.db")
    store.upsert_source(SOURCE.slug, SOURCE.url, SOURCE.label)

    outcomes = asyncio.run(scan_all([SOURCE], fetcher=StubFetcher({URL: STABLE}), store=store))

    assert len(outcomes) == 1
    assert outcomes[0].status == events.OUTCOME_FIRST_SEEN
    assert outcomes[0].snapshot_id is not None
    assert outcomes[0].title == "Endpoints"
    assert store.latest_snapshot(SOURCE.slug)["content"].startswith("# Endpoints")
    assert store.list_drifts(limit=10) == []


def test_unchanged_page_does_not_create_a_second_snapshot(tmp_path):
    store = Store(tmp_path / "radar.db")
    store.upsert_source(SOURCE.slug, SOURCE.url, SOURCE.label)
    fetcher = StubFetcher({URL: STABLE})

    asyncio.run(scan_all([SOURCE], fetcher=fetcher, store=store))
    outcomes = asyncio.run(scan_all([SOURCE], fetcher=fetcher, store=store))

    assert outcomes[0].status == events.OUTCOME_UNCHANGED
    assert outcomes[0].labels == ()
    assert store.list_sources()[0]["snapshot_count"] == 1
    assert store.list_drifts(limit=10) == []


def test_changed_page_records_a_classified_drift(tmp_path):
    store = Store(tmp_path / "radar.db")
    store.upsert_source(SOURCE.slug, SOURCE.url, SOURCE.label)

    asyncio.run(scan_all([SOURCE], fetcher=StubFetcher({URL: STABLE}), store=store))
    outcomes = asyncio.run(scan_all([SOURCE], fetcher=StubFetcher({URL: CHANGED}), store=store))

    outcome = outcomes[0]
    assert outcome.status == events.OUTCOME_CHANGED
    assert outcome.labels == ("breaking", "addition")
    assert outcome.is_breaking
    assert "no longer supported" in outcome.diff
    assert outcome.drift_id is not None

    drifts = store.list_drifts(limit=10)
    assert len(drifts) == 1
    assert drifts[0]["slug"] == SOURCE.slug
    assert drifts[0]["label"] == SOURCE.label
    assert drifts[0]["is_breaking"] is True
    assert store.list_sources()[0]["snapshot_count"] == 2


def test_failed_fetch_is_reported_and_snapshots_nothing(tmp_path):
    store = Store(tmp_path / "radar.db")
    store.upsert_source(SOURCE.slug, SOURCE.url, SOURCE.label)

    outcomes = asyncio.run(
        scan_all([SOURCE], fetcher=StubFetcher(failures={URL: "403 forbidden"}), store=store)
    )

    assert outcomes[0].status == events.OUTCOME_ERROR
    assert outcomes[0].error == "403 forbidden"
    assert store.latest_snapshot(SOURCE.slug) is None
    assert store.list_drifts(limit=10) == []


def test_empty_render_does_not_overwrite_a_good_snapshot(tmp_path):
    """A consent wall or a 200-with-an-error-body must not wipe the baseline."""

    store = Store(tmp_path / "radar.db")
    store.upsert_source(SOURCE.slug, SOURCE.url, SOURCE.label)
    asyncio.run(scan_all([SOURCE], fetcher=StubFetcher({URL: STABLE}), store=store))
    baseline = store.latest_snapshot(SOURCE.slug)

    chrome_only = "Was this page helpful?\n\nSkip to main content\n"
    outcomes = asyncio.run(
        scan_all([SOURCE], fetcher=StubFetcher({URL: chrome_only}), store=store)
    )

    assert outcomes[0].status == events.OUTCOME_ERROR
    assert "no content" in (outcomes[0].error or "")
    assert store.latest_snapshot(SOURCE.slug)["id"] == baseline["id"]
    assert store.list_sources()[0]["snapshot_count"] == 1


def test_raising_fetcher_does_not_abort_the_scan(tmp_path):
    good = SourceSpec(slug="good", url="https://good.example.com", label="Good")
    bad = SourceSpec(slug="bad", url="https://bad.example.com", label="Bad")

    store = Store(tmp_path / "radar.db")
    store.upsert_source(good.slug, good.url, good.label)
    store.upsert_source(bad.slug, bad.url, bad.label)

    class MixedFetcher(StubFetcher):
        async def fetch(self, url: str) -> FetchResult:
            if url == bad.url:
                raise RuntimeError("transport exploded")
            return await super().fetch(url)

    outcomes = asyncio.run(
        scan_all([good, bad], fetcher=MixedFetcher({good.url: STABLE}), store=store)
    )

    by_slug = {outcome.slug: outcome for outcome in outcomes}
    assert by_slug["good"].status == events.OUTCOME_FIRST_SEEN
    assert by_slug["bad"].status == events.OUTCOME_ERROR
    assert "transport exploded" in (by_slug["bad"].error or "")


def test_emit_receives_start_then_terminal_per_source(tmp_path):
    store = Store(tmp_path / "radar.db")
    second = SourceSpec(slug="second", url="https://second.example.com", label="Second")
    for spec in (SOURCE, second):
        store.upsert_source(spec.slug, spec.url, spec.label)

    seen: list[dict] = []

    async def emit(event: dict) -> None:
        seen.append(event)

    asyncio.run(
        scan_all(
            [SOURCE, second],
            fetcher=StubFetcher({URL: STABLE, second.url: STABLE}),
            store=store,
            concurrency=2,
            emit=emit,
        )
    )

    types = [event["type"] for event in seen]
    assert types.count(events.SOURCE_START) == 2
    assert types.count(events.SOURCE_COMPLETE) == 2
    assert events.SOURCE_ERROR not in types

    # Per source, start always precedes its terminal event.
    for slug in (SOURCE.slug, second.slug):
        start = next(
            index
            for index, event in enumerate(seen)
            if event["type"] == events.SOURCE_START and event["slug"] == slug
        )
        done = next(
            index
            for index, event in enumerate(seen)
            if event["type"] == events.SOURCE_COMPLETE and event["slug"] == slug
        )
        assert start < done

    # Progress payloads stay small: the diff is not a heartbeat.
    assert all("diff" not in event for event in seen)


def test_empty_source_list_and_any_breaking(tmp_path):
    store = Store(tmp_path / "radar.db")
    assert asyncio.run(scan_all([], fetcher=StubFetcher(), store=store)) == []

    store.upsert_source(SOURCE.slug, SOURCE.url, SOURCE.label)
    asyncio.run(scan_all([SOURCE], fetcher=StubFetcher({URL: STABLE}), store=store))
    outcomes = asyncio.run(scan_all([SOURCE], fetcher=StubFetcher({URL: CHANGED}), store=store))
    assert any_breaking(outcomes) is True
