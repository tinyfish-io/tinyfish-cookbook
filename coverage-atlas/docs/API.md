# HTTP API

Five route handlers under `app/api/`. All run on the Node runtime; the two that
do collection work stream Server-Sent Events.

Read routes touch only `data/` — no TinyFish, no OpenRouter, no orchestrator —
which is why the atlas loads instantly and works with no API keys configured.

| Route | Method | Streams | Needs keys |
|---|---|---|---|
| [`/api/conditions`](#get-apiconditions) | GET | no | no |
| [`/api/conditions`](#delete-apiconditions) | DELETE | no | no |
| [`/api/atlas`](#get-apiatlas) | GET | no | no |
| [`/api/changes`](#get-apichanges) | GET | no | no |
| [`/api/scan`](#post-apiscan) | POST | **SSE** | yes |
| [`/api/verify`](#post-apiverify) | POST | no | yes |

---

## GET /api/conditions

Every saved condition, enriched with enough freshness metadata to render the
switcher without a second round trip.

```jsonc
{
  "conditions": [
    {
      "slug": "obesity_glp_1_receptor_agonists",
      "userInput": "GLP-1 drugs for weight loss",
      "name": "Obesity",
      "treatmentClass": "GLP-1 receptor agonists",
      "treatments": ["Wegovy", "Zepbound", "semaglutide", "tirzepatide"],
      "policyLever": "Coverage for the obesity indication is optional for state Medicaid programs; only the type 2 diabetes indication is federally mandated.",
      "searchTerms": ["semaglutide", "wegovy", "zepbound", "glp-1", "..."],
      "builtIn": false,
      "createdAt": "2026-08-23T18:02:11.004Z",
      "snapshots": ["2026-08-23T18-45-12-345Z"],
      "lastScannedAt": "2026-08-23T18:45:12.345Z",
      "stateCount": 51,
      "changeCount": 14
    }
  ]
}
```

## DELETE /api/conditions

```
DELETE /api/conditions?slug=<slug>
```

`{ "ok": true }`, or `400` with `{"error":"built-in conditions cannot be removed"}`.
Removes the spec; snapshots and change feeds on disk are left alone.

## GET /api/atlas

Everything one view of the atlas needs, in one response.

| Param | Required | Notes |
|---|---|---|
| `condition` | yes | Condition slug |
| `asOf` | no | Snapshot stamp, full ISO instant, or `YYYY-MM-DD` |

`asOf` resolves to the **newest snapshot at or before** that moment, which is
what makes the view-date control real rather than decorative: picking an earlier
date shows what the scanner actually believed then, not a filtered version of
what it believes now. A date before the first scan yields the earliest snapshot
available rather than an empty map.

```jsonc
{
  "conditionSlug": "obesity_glp_1_receptor_agonists",
  "scannedAt": "2026-08-23T18:45:12.345Z",
  "records": [ /* CoverageRecord[] — see DATA-MODEL.md */ ],
  "sources": [
    { "url": "...", "title": "...", "siteName": "...", "kind": "national_tracker",
      "statesAddressed": 38, "usedFor": "Baseline for 38 jurisdictions" }
  ],
  "ledger": { /* RunLedger */ },
  "snapshots": ["2026-05-23T09-11-02-771Z", "2026-08-23T18-45-12-345Z"],
  "outliers": [
    { "state": "MA", "stateName": "Massachusetts", "kind": "easiest",
      "headline": "Lowest friction in the country", "detail": "…" }
  ]
}
```

`404` with `{"error":"no snapshot yet","records":[]}` when the condition has
never been scanned — the UI turns this into a "run a scan" prompt rather than an
error.

## GET /api/changes

| Param | Required | Default | Notes |
|---|---|---|---|
| `condition` | yes | — | Condition slug |
| `days` | no | `90` | Look-back window |

Events are ranked by **how much access moved**, not by date: a state closing its
only pathway outranks three states rewording a form, however recent the
rewording. Each event is joined to the state's current status.

```jsonc
{
  "days": 90,
  "events": [
    { "id": "MA-coverage_dropped-2026-07-01", "state": "MA", "stateName": "Massachusetts",
      "direction": "coverage_dropped", "headline": "Massachusetts ended its coverage pathway",
      "detail": "Status moved from conditional to not covered.",
      "fromStatus": "conditional", "toStatus": "not_covered", "frictionDelta": 47,
      "announcedOn": "2026-07-01", "effectiveOn": "2026-07-01",
      "sourceDoc": "…", "sourceUrl": "…",
      "provenance": "historical", "detectedAt": "2026-08-23T18:45:12.345Z",
      "currentStatus": "not_covered" }
  ],
  "summary": { "total": 14, "widened": 5, "tightened": 9, "observed": 6, "historical": 5, "reported": 3 }
}
```

## POST /api/scan

Runs a full scan and streams it. `maxDuration` 800s.

```jsonc
// request
{
  "condition": "GLP-1 drugs for weight loss",  // free text, or a saved slug
  "depth": "standard",                          // "baseline" | "standard" | "deep"
  "agentBudget": 6,                             // optional; metered browser-run ceiling
  "limits": {                                   // optional; hard ceilings
    "maxTinyfishCalls": 200,
    "maxSteps": 80
  }
}
```

Responds `text/event-stream` with `Cache-Control: no-cache, no-transform` and
`X-Accel-Buffering: no`. A `: ping` comment is emitted first to defeat proxy
buffering.

`500` before the stream opens if `TINYFISH_API_KEY` or `OPENROUTER_API_KEY` is
missing; `400` on a malformed body or empty condition.

### Event types

Each SSE `data:` line is one JSON object with a `type`.

| `type` | Payload | Fires |
|---|---|---|
| `phase` | `{phase, note}` | Throughout — human-readable progress |
| `condition` | `{spec}` | Once resolution completes |
| `plan` | `{total, fromBaseline, toFanOut}` | **Before** the fan-out |
| `state` | `{record, done, total}` | Once per jurisdiction, as it lands — and again when backfill or inference revises it |
| `budget` | `{tinyfishCalls, maxTinyfishCalls, steps, maxSteps}` | After each phase and each wave |
| `changes` | `{observed, historical, reported}` | After delta computation |
| `complete` | `{snapshotStamp, ledger, outliers}` | Terminal, on success |
| `error` | `{message}` | Terminal, on failure |

The `plan` event firing before the fan-out is deliberate: the ratio it carries —
how many jurisdictions one shared read settled versus how many needed their own
subagent — is the efficiency argument, visible while it happens.

`state` can fire more than once for the same jurisdiction. The backfill pass
revises records in place as it closes gaps, and each revision re-emits, so the
map corrects itself live. Consumers should key on `record.state`, not append.

`phase` notes are the human-readable narration the UI shows as its one-line
"what is it doing right now" indicator; the `phase` field itself maps to a verb
(`fanout` → "Reading state policy documents", `backfill` → "Chasing down missing
information").

### Consuming it

Parse **line-buffered**, keeping the partial trailing line between chunks. A
chunk boundary lands mid-JSON often enough that splitting on `\n\n` and hoping
drops roughly one state per scan — and a state silently missing from the map is
the exact failure this product cannot have. The reference implementation is
`useScan` in `components/coverage-atlas/use-atlas.ts`.

Aborting the request closes the stream but **does not stop the scan**. It
continues headless and still writes its snapshot.

```bash
curl -N -X POST http://localhost:3000/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"condition":"continuous glucose monitors","depth":"standard"}'
```

## POST /api/verify

Re-reads one state's source on the spot. `maxDuration` 300s.

```jsonc
// request
{ "state": "TX", "condition": "obesity_glp_1_receptor_agonists" }
```

Runs the same subagent the sweep uses with a browser budget of **one**, so it
escalates through the stealth agent when the state portal refuses a plain fetch.
The result patches the newest snapshot in place.

```jsonc
{
  "ok": true,
  "record": { /* CoverageRecord */ },
  "changed": true,          // status moved, or friction moved ≥ 6
  "method": "agent",        // ladder rung that answered
  "escalated": true,        // a metered browser run was spent
  "shortCircuited": false,  // evidence hash was unchanged — free
  "durationMs": 41880
}
```

When `changed` is true the disagreement is written to the change feed as an
`observed` event. A scanner that quietly corrects itself is hiding the most
interesting thing it does.

`502` with `{"ok":false,"error":"…"}` on failure; `404` for an unknown condition,
`400` for an unknown state code.
