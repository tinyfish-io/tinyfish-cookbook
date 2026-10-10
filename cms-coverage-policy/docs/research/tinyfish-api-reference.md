# TinyFish API Reference (derived from tinyfish-cookbook)

> Research agent output, 2026-08-21. Endpoints, auth, SDK patterns, and the best reference apps in the cookbook. All claims cite cookbook files.

## 1. Endpoints

| Primitive | Base URL / Path | Method | Auth | Notes |
|---|---|---|---|---|
| **Search** | `https://api.search.tinyfish.ai?query=<urlencoded>` | GET | `X-API-Key` | Free. `README.md:63-65`, `tutor-finder/src/app/api/discover/route.ts:19-26` |
| **Fetch** | `https://api.fetch.tinyfish.ai` | POST `{"urls":[...]}` | `X-API-Key` | Free. `README.md:67-70` |
| **Agent (SSE stream)** | `https://agent.tinyfish.ai/v1/automation/run-sse` | POST | `X-API-Key` | Metered. `README.md:73-77` |
| **Agent (sync run)** | `/v1/automation/run` | POST | `X-API-Key` | **Avoid** — see gotchas (`waifu-deal-sniper/bot.js:36-37`) |
| **Run status** | `https://agent.tinyfish.ai/v1/runs/<run_id>` | GET | `X-API-Key` | Polling for queued runs |
| **MCP server** | `https://agent.tinyfish.ai/mcp` | — | OAuth | `plugins/tinyfish/.mcp.json:5` |
| Dashboard/keys | `https://agent.tinyfish.ai/api-keys` | — | — | `README.md:241` |

## 2. Authentication

- Header: **`X-API-Key: $TINYFISH_API_KEY`** (not `Authorization: Bearer`).
- Env var is universally `TINYFISH_API_KEY`.
- SDK: `new TinyFish({ apiKey })` or zero-arg `new TinyFish()` (reads env itself) — `competitor-scout-cli/lib/tinyfish.ts:14-18`.
- Routes guard the key first and return 500 if missing — `district-rent-shark/src/app/api/search/route.ts:154-157`.

## 3. SDKs (strongly preferred over raw fetch)

- **TypeScript: `@tiny-fish/sdk`** (~30 apps; newest pin `^0.0.9`). **Python: `tinyfish`** (`AsyncTinyFish`). **CLI: `@tiny-fish/cli`**.
- Constructor options: `new TinyFish({ apiKey, timeout: 30_000, maxRetries: 1 })` (`worldcup-briefing/src/lib/video-pipeline.ts:281-285`); `timeout: 780_000` for long agent routes (`district-rent-shark/src/app/api/search/route.ts:96`).

## 4. Request shapes

### Agent — streaming (the workhorse)
```ts
const stream = await client.agent.stream(
  {
    url,                                      // required
    goal: GOAL_PROMPT,                        // required, natural language
    browser_profile: BrowserProfile.STEALTH,  // "lite" (default) | "stealth"
    proxy_config: { enabled: true, country_code: "US" },
  },
  {
    onStreamingUrl: (e) => { /* e.streaming_url, e.run_id */ },
    onComplete:     (e) => { /* e.status, e.result, e.error */ },
  },
);
```
Sources: `openbox-deals/src/app/api/search/live/route.ts:82-108`, `saigon-happy-hour-sniper/src/app/api/search/route.ts:103-120`, `silicon-signal/src/app/api/scan/route.ts:187-193`, `research-sentry/lib/tinyfish.ts:41-59`.

### Agent — queue + poll (long/bulk runs)
```ts
const queued = await client.agent.queue({ url, goal, browser_profile: "stealth" }); // → { run_id, error? }
const run = await client.runs.get(queued.run_id); // → { run_id, status, result, error: { message, category } }
```
Sources: `AABW_Vietnam_Hackathon_Samples/fareguard/lib/agents.ts:76-104`, `rateradar/src/lib/rates.ts:86-96`.

### Search
```ts
const res = await client.search.query({ query, location: "US", language: "en" });
```
Extra HTTP/MCP params: `domain_type` (`web`|`news`|`research_paper`), `recency_minutes`, `after_date`/`before_date`, `page`, `purpose` — `plugins/tinyfish/skills/search/SKILL.md`.

### Fetch
```ts
const res = await client.fetch.getContents({
  urls,                 // 1–10 URLs, parallel server-side
  format: "markdown",   // "markdown" | "html" | "json"
  links: true, image_links: true,
});
```
Extra params: `include_selectors`/`exclude_selectors`, `if_none_match`/`if_modified_since`, `per_url_timeout_ms` — `plugins/tinyfish/skills/fetch/SKILL.md`.

### Structured output
**Cookbook convention: encode the desired JSON shape inside the goal string** (`district-rent-shark/src/app/api/search/route.ts:35-68`, `viet-bike-scout/src/app/api/search/route.ts:37-74`). An `output_schema` param exists on the agent surface (`plugins/tinyfish/skills/agent/SKILL.md`, plus `agent_config.max_duration_seconds`, `mode: "strict"`), but goal-embedded JSON is the proven path.

## 5. Response shapes

### Agent SSE events
`STARTED` → `STREAMING_URL` (optional) → repeated `PROGRESS` → `COMPLETE`. Enums exported: `EventType`, `RunStatus`, `BrowserProfile`.
```jsonc
{"type":"STARTED","run_id":"run_1","timestamp":"..."}
{"type":"STREAMING_URL","run_id":"run_1","streaming_url":"https://agent.tinyfish.ai/stream/run_1"}
{"type":"PROGRESS","run_id":"run_1","purpose":"Dismissing cookie banner..."}
{"type":"COMPLETE","run_id":"run_1","status":"COMPLETED","result":{...},"error":null}
```
Exact mocked shapes: `district-rent-shark/src/__tests__/api-route.test.ts:41-66`.

- Final data = `event.result` when `status === RunStatus.COMPLETED`.
- `result` may be a **string** — parse defensively (`viet-bike-scout/.../route.ts:105-107`).
- Some payloads nest: `run.result?.result ?? run.result` (`rateradar/src/lib/rates.ts:96`). Field drift exists: `result_json ?? resultJson ?? result` (`silicon-signal/src/app/api/scan/route.ts:213-217`).
- **Critical convention:** *"COMPLETED only means the browser ran without crashing — always validate result content, not just the status."* (repeated verbatim in district-rent-shark, fast-qa, bestbet)

### Search response
`{ query, total_results, results: [{ position, site_name, title, snippet, url }] }`

### Fetch response
`{ results: [{ url, final_url, title, description, language, format, text, links, image_links, latency_ms }], errors: [{ url, error }] }` — per-URL failures land in `errors[]`, not thrown; match by `url` **or** `final_url`.

### Run object (polling)
`{ run_id, status: "PENDING"|"RUNNING"|"COMPLETED"|"FAILED"|"CANCELLED", result, error: { message, category } }`

## 6. Recommended Next.js calling pattern

Server-side only, App Router API routes. Zero server actions in the cookbook; no job queues — long work lives inside the streaming route.

```ts
export const runtime = "nodejs";
export const maxDuration = 800;   // Vercel Pro allows 800s for Node runtime
```

Standard route shape (minimal version: `bestbet/app/api/scrape/route.ts:9-66`):
1. Guard `TINYFISH_API_KEY` → 500; guard body JSON → 400.
2. Build a `ReadableStream`; emit `: ping\n\n` first to defeat proxy buffering.
3. Fan out sites with `Promise.allSettled`, each running `client.agent.stream(...)`, re-emitting app-level events as `data: ${JSON.stringify(payload)}\n\n`.
4. `break` out of the `for await` loop on `COMPLETE`.
5. Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
6. Client consumes with `response.body.getReader()` + `TextDecoder` + line buffer keeping the partial line (`pharmacy-panic/src/hooks/use-pharmacy-search.ts:68-90`).

Poll (`agent.queue()` + `runs.get()`) instead of stream for multi-minute sweeps or bulk.

## 7. Timeouts, retries, concurrency, rate limits

- **Never use `agent.run()`** — can return while still in progress with `result: null` (`waifu-deal-sniper/bot.js:33-38`); only for <30s tasks (`rateradar/src/lib/tinyfish.ts:13-15`).
- **Best polling reference:** `rateradar/src/lib/tinyfish.ts:17-67` — `intervalMs=3000`, `timeoutMs=280000`, tolerate 5 consecutive connection errors, and **treat non-empty `run.result` as done even if `status` is stale** (documented server-side stuck-status bug).
- **Concurrency: waves of 5** agent calls (`rateradar/src/lib/batch.ts:1-17` — "matching TinyFish's plan-based concurrency limits"); MCP batch caps at 8 runs.
- Python retry policy worth mirroring: retry on connection/timeout/5xx/rate-limit, 3 attempts, exponential 2–10s (`finsight/api/services/tinyfish_client.py:22-57`).
- Per-request abort + typed error codes (`MISSING_API_KEY | RUN_FAILED | TIMEOUT | STREAM_ERROR | NO_RESULT`): `research-sentry/lib/tinyfish.ts:4-100`.
- Per-site isolation: one failing agent must not kill the batch — `Promise.allSettled` or per-task try/catch → null.
- MCP guidance: a run can time out client-side while still running server-side — don't blind-retry; check `get_run`/`list_runs`.

## 8. Documented conventions

- **Escalation ladder: `search → fetch → agent → browser`** — lightest tool first (`skills/use-tinyfish/SKILL.md`).
- Always specify the JSON structure you want inside the goal.
- **One agent call per site** — never combine multiple sites into one goal.
- `TINYFISH_DEBUG=1` logs HTTP requests to stderr.
- Contribution requirement: every recipe README includes a snippet calling the TinyFish API (`CONTRIBUTING.md:47-49`).

## 9. Best reference apps

1. **`district-rent-shark`** — cleanest full Next.js SSE agent route (STEALTH, `maxDuration=800`, `Promise.allSettled` fan-out) + the only unit tests pinning exact SDK event shapes (`src/__tests__/api-route.test.ts:19-66`).
2. **`openbox-deals`** — per-site config driving agent options + callbacks form of `agent.stream(params, handlers)` (`src/app/api/search/live/route.ts:82-140`, `src/lib/sites.ts:1-40`).
3. **`AABW_Vietnam_Hackathon_Samples/rateradar`** — queue+poll reference with the most battle-tested error handling (`src/lib/tinyfish.ts`, `src/lib/batch.ts`).

Honorable mentions: `competitor-scout-cli/lib/tinyfish.ts` (single-file typed wrapper over all four primitives), `anime-watch-hub/docs/tinyfish-api-integration.md` (written-up SSE event table), `tinyskills/app/api/scrape-sources/route.ts` (Search→Fetch pipeline).
