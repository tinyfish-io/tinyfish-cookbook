# Docs Drift Radar

**Live Demo:** _add URL after deploy_

**Watch the docs that your code depends on, and get told the moment they change — with the diff, not just a notification.**

You register docs, changelog, and API-reference URLs. On every run the recipe fetches each page with the **TinyFish Fetch** endpoint, normalizes the markdown, and compares it to the last snapshot. Unchanged pages cost nothing to check and produce nothing to read; changed pages produce a classified drift report — *breaking*, *deprecation*, *security*, *pricing*, *addition* — with the exact lines that moved. `scan` exits `1` when a breaking change is found, so a cron job or CI step can fail on it.

Built on the official **TinyFish Python SDK** (`pip install tinyfish`) — this is the cookbook's first Python recipe. It uses Fetch only, which is free, so the deployed demo never burns credits.

## Why Fetch is the right endpoint

| Endpoint | Why not |
|---|---|
| Search | We already know the URLs. Discovery is not the problem. |
| Agent | Metered, and a docs page needs no clicking — Fetch renders it. |
| Browser | We would be re-implementing what Fetch already does for free. |
| **Fetch** ✅ | Any URL → clean markdown, real browser rendering, **free** (failed URLs included). |

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Sources (SQLite)                                                  │
│  sources.yaml  ──seed──►  sources(slug, url, label)                │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                    python -m docs_drift_radar scan
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│  scanner.scan_all()            asyncio.Semaphore(concurrency)      │
│                                                                │    │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │    │
│   │ source A     │   │ source B     │   │ source C     │  ...  │    │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘       │    │
└──────────┼──────────────────┼──────────────────┼────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
   TinyFish Fetch (free) — urls=[url], format="markdown"
           │                  │                  │
           ▼                  ▼                  ▼
┌────────────────────────────────────────────────────────────────────┐
│  normalize.py    strip chrome (nav, "last updated", feedback widgets)│
│                  fold CRLF, collapse blank runs, keep code verbatim  │
│                        └──► sha256 content_hash                     │
└───────────────────────────────┬────────────────────────────────────┘
                                │
              hash unchanged?  ──┴──► record nothing, move on
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  diffing.py      difflib.unified_diff + keyword classification      │
│  store.py        snapshots(content, hash, title) · drifts(diff)      │
└───────────────────────────────┬────────────────────────────────────┘
                                │
              ┌─────────────────┴──────────────────┐
              ▼                                    ▼
    report.py (markdown / JSON)          api.py (FastAPI + SSE)
    CLI output, exit 1 on breaking       static/index.html dashboard
```


## Where TinyFish is called

Everything goes through one method — `docs_drift_radar/tinyfish_client.py`:

```python
from tinyfish import AsyncTinyFish                      # pip install tinyfish
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

client = AsyncTinyFish(timeout=45.0, max_retries=2)     # reads TINYFISH_API_KEY

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception(_is_retryable),            # transport / 5xx / rate limit
    reraise=True,
)
async def _get_contents(self, url: str) -> object:
    return await self._client.fetch.get_contents(urls=[url], format="markdown")

response = await _get_contents("https://docs.tinyfish.ai/key-concepts/endpoints")

if response.results:
    markdown = response.results[0].text          # clean markdown, ready to diff
if response.errors:
    problem = response.errors[0].error           # failed URLs are free
```

Two deliberate choices:

- **One URL per call.** The SDK accepts up to ten, but then result-to-source mapping depends on response ordering. One call per URL plus `asyncio.Semaphore` for concurrency keeps the mapping unambiguous.
- **Defensive field reads.** `text`/`content`/`markdown` and `error`/`message`/`reason` are all accepted, so a field rename upstream shows up as a clear message instead of a silent empty snapshot.

## What a drift looks like

````
$ python -m docs_drift_radar scan
first_seen  docs-tinyfish-ai-key-concepts-endpoints   TinyFish Agent Endpoints
changed     fastapi-tiangolo-com-release-notes        +38/-12 breaking,addition
unchanged   nextjs-org-blog

3 source(s) · 1 changed · 0 failed

$ python -m docs_drift_radar report --source fastapi-tiangolo-com-release-notes
# Docs Drift Radar

Generated 2026-09-27T16:20:11+00:00 · **1 drift(s)** across **1 source(s)** · **1 breaking**

## fastapi-tiangolo-com-release-notes

- **Source:** FastAPI Release Notes
- **URL:** https://fastapi.tiangolo.com/release-notes/
- **Detected:** 2026-09-27T16:20:11+00:00
- **Changed:** +38 / −12 lines
- **Classified:** `breaking` `addition`

```diff
--- fastapi-tiangolo-com-release-notes@2026-09-26T09:00:04+00:00
+++ fastapi-tiangolo-com-release-notes@2026-09-27T16:20:11+00:00
@@ -41,7 +41,9 @@
 ## 0.116.0
-- `on_event` is the supported way to register handlers.
+- `on_event` is deprecated and will be removed in 1.0; use `lifespan` instead.
+- New `app.state` helpers are available.
```
````

Because the drift carried `breaking`, that `scan` exited **1**.

## CLI

| Command | What it does |
|---|---|
| `add <url> [--label] [--slug]` | Add or update a watched URL |
| `scan [--source SLUG] [--concurrency N] [--json] [--no-seed]` | Fetch every source, snapshot, record drifts |
| `report [--format md\|json] [--limit N] [--since ISO] [--source SLUG]` | Print recorded drift |
| `diff <slug> [--context N]` | Diff the two most recent snapshots of one source |
| `sources` | List watched sources with snapshot and drift counts |
| `serve [--host] [--port] [--reload]` | Run the API and the dashboard |

Exit codes are the CI contract:

| Code | Meaning |
|---|---|
| `0` | Scan completed, nothing classified as breaking |
| `1` | Scan completed, at least one source reported a **breaking** change |
| `2` | The scan could not run (no API key, no sources, unexpected error) |

```bash
# Nightly: fail the job if any watched doc changes in a breaking way.
0 6 * * *  cd /srv/docs-drift-radar && .venv/bin/python -m docs_drift_radar scan || \
           .venv/bin/python -m docs_drift_radar report --format md | mail -s "docs drift" you@example.com
```

## HTTP API

| Route | Purpose |
|---|---|
| `GET /` | Vanilla-JS dashboard (no build step) |
| `GET /api/health` | Status, version, source/drift counts, whether a key is configured |
| `GET /api/events` | The scan progress contract — event and outcome names |
| `GET /api/sources` | Watched sources with snapshot/drift counts |
| `POST /api/sources` | `{"url": "...", "label": "?", "slug": "?"}` |
| `DELETE /api/sources/{slug}` | Remove a source, its snapshots, and its drifts |
| `GET /api/drifts` | Recorded drifts (`?limit=&slug=&since=`) |
| `GET /api/report` | `?format=md` for markdown, otherwise JSON |
| `POST /api/scan` | Scan sources, streaming progress as Server-Sent Events |

`POST /api/scan` emits `data:` frames, one JSON object each:

```
data: {"type": "source_start",    "slug": "docs-...", "url": "..."}
data: {"type": "source_complete", "slug": "docs-...", "status": "changed", "added": 38, "removed": 12, "labels": ["breaking"]}
data: {"type": "source_error",    "slug": "docs-...", "error": "403 forbidden"}
data: {"type": "scan_complete",   "scanned": 3, "changed": 1, "errors": 0, "breaking": true}
```

Progress frames deliberately omit the diff — a diff is a report, not a heartbeat.

## Demo

The dashboard, after a scan that found one breaking change:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Docs Drift Radar                                                        │
│  3 source(s) · 4 drift(s)                                                │
├──────────────────────────────────────────────────────────────────────────┤
│  [ Scan all sources ]  [ Refresh ]   3 scanned · 1 changed · 0 failed    │
│  16:20:11  event contract: source_start, source_complete, source_error,  │
│            scan_complete                                                 │
│  16:20:11  scan started                                                  │
│  16:20:11  → docs-tinyfish-ai-key-concepts-endpoints                     │
│  16:20:11  → fastapi-tiangolo-com-release-notes                          │
│  16:20:11  → nextjs-org-blog                                             │
│  16:20:12    docs-tinyfish-ai-key-concepts-endpoints: first_seen         │
│  16:20:13    nextjs-org-blog: unchanged                                  │
│  16:20:14    fastapi-tiangolo-com-release-notes: changed +38/−12         │
│  16:20:14  scan complete                                                 │
│                                                                          │
│  Detected drift                                                          │
│  FastAPI Release Notes  [breaking] [addition]                            │
│  2026-09-27T16:20:14+00:00 · +38 / −12                                   │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ --- fastapi-tiangolo-com-release-notes@2026-09-26T09:00:04+00:00   │  │
│  │ +++ fastapi-tiangolo-com-release-notes@2026-09-27T16:20:14+00:00   │  │
│  │ @@ -41,7 +41,9 @@  ## 0.116.0                                      │  │
│  │ -- `on_event` is the supported way to register handlers.           │  │
│  │ +- `on_event` is deprecated and will be removed in 1.0.            │  │
│  │ +- New `app.state` helpers are available.                          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

> **Recording a GIF:** this recipe was contributed without a screen recording.
> `asciinema rec demo.cast` while running `scan` then `report`, or a terminal GIF
> of the dashboard, is the remaining asset — swap it in here.

## Setup

### Prerequisites

- Python 3.11+ (developed on 3.12)
- A TinyFish API key — **free**, no credit card: <https://agent.tinyfish.ai/>

### Environment variables

```bash
cp .env.example .env
```

```env
# Required — Fetch is free, so a free key is enough.
TINYFISH_API_KEY=your-tinyfish-api-key

# Optional
DOCS_DRIFT_DB=docs_drift_radar.db     # SQLite path
DOCS_DRIFT_CONFIG=sources.yaml        # watchlist seeded into an empty store
DOCS_DRIFT_CONCURRENCY=5              # parallel fetches
DOCS_DRIFT_TIMEOUT_SECONDS=45
```

`.env` is gitignored, and only `.env.example` is committed. The repo runs
TruffleHog and a secrets scanner in CI, so never paste a real key into a tracked file.

### Install and run

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Watchlist: edit sources.yaml, or add URLs one at a time.
.venv/bin/python -m docs_drift_radar add https://docs.example.com/changelog --label "Example changelog"

# First scan records baselines; later scans record drift.
.venv/bin/python -m docs_drift_radar scan
.venv/bin/python -m docs_drift_radar report
.venv/bin/python -m docs_drift_radar diff docs-example-com-changelog

# Dashboard + JSON API
.venv/bin/python -m docs_drift_radar serve
# open http://127.0.0.1:8000
```

Deploying the demo needs no build step: any host that runs a Python web process
(Render, Railway, Fly) works with `uvicorn docs_drift_radar.api:app`, because the
dashboard is one static HTML file served by FastAPI.

## Tests

```bash
.venv/bin/python -m pytest
```

53 tests, no network and no API key required — the fetcher is injected:

| File | Covers |
|---|---|
| `tests/test_normalize.py` | Chrome stripping never moves the hash; code fences survive |
| `tests/test_diffing.py` | Diff counts, classification rules and their order, truncation |
| `tests/test_store.py` | Schema, filtering, label decoration, delete cascade |
| `tests/test_scanner.py` | `first_seen → unchanged → changed`, per-source failure isolation |
| `tests/test_config.py` | Slug derivation, watchlist parsing, env precedence |
| `tests/test_api.py` | Every HTTP route, source CRUD, SSE contract publication |

## Project structure

```
docs-drift-radar/
├── docs_drift_radar/
│   ├── __main__.py          # CLI: add | scan | report | diff | sources | serve
│   ├── api.py               # FastAPI app: JSON routes, SSE scan, dashboard mount
│   ├── config.py            # Settings from env + sources.yaml/JSON watchlist loader
│   ├── tinyfish_client.py   # The only place that calls TinyFish (Fetch, retries)
│   ├── normalize.py         # Chrome stripping, stable hashing, title extraction
│   ├── diffing.py           # Unified diff + change classification
│   ├── events.py            # Single source of truth for SSE event names
│   ├── scanner.py           # Concurrent orchestration, one outcome per source
│   ├── report.py            # Markdown and JSON rendering
│   └── store.py             # SQLite: sources, snapshots, drifts
├── static/index.html        # Dashboard — vanilla JS, no build step
├── tests/                   # 53 tests, offline
├── sources.yaml             # Example watchlist
├── requirements.txt         # Pinned, matching finsight/monai in this cookbook
├── .env.example
└── pytest.ini
```

## Two design notes

**Normalization is invisible or it is a bug.** Chrome removal must not change the
normalized text, or an untouched page would report drift every single run. The failed
test that shipped with the first draft caught exactly this: dropping
`Last updated: September 27, 2026` from between two paragraphs reset the blank-line
counter, which *added* a blank line and moved the hash. Noise lines are now fully
invisible — see `tests/test_normalize.py::test_render_chrome_does_not_change_the_hash`.
Fenced code is passed through verbatim, because a code sample is often precisely what
changed and reformatting it would corrupt the diff a reviewer reads.

**Progress event names are published, not hard-coded.** `events.py` owns them, the API
serves them from `GET /api/events`, and the dashboard fetches that list at boot and
warns on anything unexpected. A renamed event therefore fails loudly in the console
instead of leaving a client waiting for a message that will never arrive.

## Limitations

- **Change classification is keyword heuristics.** `deprecated`, `no longer supported`,
  `CVE-…`, currency amounts, and similar. It is a triage aid, not a semantic diff — read
  the diff for anything that matters. It is intentionally tuned for near-zero false
  positives, which means it will miss subtle breakages.
- **Drift is detected, not interpreted.** The recipe tells you *what* changed on a page;
  deciding whether it affects your code is your call (or your LLM's).
- **JS-heavy pages** render via Fetch, but infinite-scroll or login-walled content will
  look like a failed read (reported per source, never as an empty snapshot).
- **No diff storage cap.** A page that rewrites itself wholesale (a "latest news" list)
  will produce a large drift row. Add a source-specific ignore rule, or watch the
  changelog URL rather than the homepage.
- **No notification channels.** Output is CLI/HTTP by design; wire `report --format md`
  into whatever you already use for alerts.

## Cost

Fetch is **free for everyone** with generous rate limits, including failed URLs, so a
scheduled scan costs nothing. This recipe never calls the metered Agent endpoint.

## Adding it to your own stack

- `export` the SQLite file, or point `DOCS_DRIFT_DB` at a mounted volume.
- Run `scan` on a schedule, and treat exit code `1` as "a doc changed in a breaking way".
- The FastAPI app is a normal ASGI app: `uvicorn docs_drift_radar.api:app --host 0.0.0.0`.

> Contributed to the [TinyFish Cookbook](../README.md). See
> [CONTRIBUTING.md](../CONTRIBUTING.md) to add your own recipe.
