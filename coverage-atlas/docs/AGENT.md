# The collection agent

The part that actually goes and gets the data. An orchestrator that owns the
plan, the budget and the merge, and per-state subagents that own nothing else.

- [Design in one paragraph](#design-in-one-paragraph)
- [Phase 0 · Resolve](#phase-0--resolve)
- [Phase 1 · Discover](#phase-1--discover)
- [Phase 2 · Baseline](#phase-2--baseline)
- [Phase 3 · Fan-out and the escalation ladder](#phase-3--fan-out-and-the-escalation-ladder)
- [Phase 3b · Backfill](#phase-3b--backfill)
- [Phase 4 · Changes](#phase-4--changes)
- [Phase 5 · Derive and persist](#phase-5--derive-and-persist)
- [Budgets and termination](#budgets-and-termination)
- [Token economics](#token-economics)
- [Model routing](#model-routing)
- [Tuning](#tuning)
- [Extending it](#extending-it)

---

## Design in one paragraph

The orchestrator does no extraction. Its entire job is to decide how little work
the scan can get away with and still be right, then hand each remaining piece to
a subagent that knows nothing except its own state. Work is eliminated in five
places — a shared read that answers most of the country, a plan that only fans
out the residue, an evidence hash that makes re-scans nearly free, windowing that
cuts documents by an order of magnitude before a model sees them, and two-tier
model routing — and every run measures what that saved against a naive
whole-document-per-state loop.

```
resolve → discover → baseline → fan-out → backfill → [infer] → changes → diff → snapshot
  smart     search      fetch     ladder    leads +    on cap    search    pure    disk
   ×1        ×4        ×1+smart   cheap×n   batched              smart×1   code
                                            fetch
```

Two hard ceilings bound the whole thing — **200 TinyFish calls** and **80
orchestrator steps** — and the scan stops early, before either binds, once every
jurisdiction carries a timestamped, cited answer. See
[Budgets and termination](#budgets-and-termination).

## Phase 0 · Resolve

`agent/phases/resolve.ts` — one smart-model call.

Users type "Ozempic", "weight loss drugs", "kids with autism". None of those are
searchable policy terms. Resolution turns free text into a `ConditionSpec`:

| Field | Purpose |
|---|---|
| `name` | Canonical condition or indication |
| `treatmentClass` | What state policy is actually written about |
| `treatments` | Brand and generic names as a preferred drug list would print them |
| `searchTerms` | 6–12 lowercase phrases the windowing function greps for |
| `policyLever` | **Why states are permitted to differ at all** |
| `slug` | Stable key for the store |

`policyLever` is the field that shapes the narrative, and it is also a guard. If
a treatment is federally mandated in every state there is no fifty-state story to
tell. GLP-1s are the clearest case: the type 2 diabetes indication is federally
mandated everywhere, so the scannable target is the **obesity / weight-management
indication**, which is optional for states and therefore varies. Resolution is
instructed to make exactly that move.

Free text that matches a saved condition by name or by the exact words the user
originally typed skips this call entirely.

## Phase 1 · Discover

`agent/phases/discover.ts` — four TinyFish searches (free), one cheap ranking
call.

An arbitrary condition has no hardcoded tracker, so the scanner goes looking. The
heuristic that matters: **a page that addresses many states at once is worth an
order of magnitude more than a page about one state**, because a single fetch of
it seeds the entire baseline. So the queries deliberately hunt for that document
shape —

```
Medicaid coverage of <class> for <condition> by state 2026
<class> state Medicaid coverage all 50 states comparison table
state Medicaid <class> prior authorization criteria state-by-state
KFF Medicaid <class> <condition> coverage tracker
```

— and results are ranked by expected state coverage first, authority second.
Consumer marketing pages, telehealth vendors and law-firm ads are excluded
explicitly; news is kept only for dated policy changes.

## Phase 2 · Baseline

`agent/phases/baseline.ts` — one TinyFish fetch (free), one smart normalisation
call per tracker.

The cheapest fifty-state table in the pipeline. Fetch the two or three
multi-state trackers discovery surfaced, clip to 70k characters, and normalise in
a single model call that returns up to 51 rows. On a typical condition this alone
answers 35–45 jurisdictions.

Trackers are consumed best-ranked-first and **the first tracker to address a
state wins** — later trackers fill gaps rather than overwrite. Once 48
jurisdictions are settled the loop stops; the tail belongs to the fan-out.

Two rules in the prompt earn their place:

**The stability rule.** The call is given the statuses we already hold and told
to keep them unless the document plainly and specifically contradicts them, with
borderline "covered vs covered-with-limits" calls resolving to the current
status. Without this, a model that resolves a borderline call differently on
Tuesday than on Monday manufactures a policy change that never happened. Every
reported change is published to users as an alert, so the bar for moving one is
deliberately high.

**Verbatim is verbatim.** `criteriaVerbatim` must be exact characters from the
document or `null`. Paraphrase belongs in `criteriaSummary` and nowhere else,
because the compare view puts the two states' original wording side by side and a
blurred quote defeats the point of the view.

## Phase 3 · Fan-out and the escalation ladder

`agent/phases/subagent.ts` — the volume, and where a naive design burns its
budget.

**The subagent contract.** A subagent receives one state, the condition spec,
the baseline row for that state if one exists, and the prior scan's record for
that state. It never sees the other fifty states, the tracker document, the
orchestrator's reasoning, or its siblings' results. Its context is a couple of
thousand tokens and it returns exactly one `CoverageRecord`.

Which states get one depends on depth:

| Depth | Fans out | Use when |
|---|---|---|
| `baseline` | Nothing | Seconds, near-free. Refreshing a condition whose trackers are current. |
| `standard` *(default)* | States the baseline missed, marked below high confidence, or left without verbatim criteria | The normal scan. |
| `deep` | All 51 | Best verbatim coverage, slowest and most expensive. |

Each subagent walks the ladder and **stops at the first rung that answers**:

### Rung 0 · Carry-forward — free

Hash the windowed evidence. If it equals the hash stored on the previous scan's
record, the source document has not moved: carry the record forward with a
refreshed `lastCheckedAt` and `method: "carried_forward"`. Zero model tokens,
zero metered calls.

On a re-scan most states land here. This is what makes a scheduled scanner
affordable, and it is the same mechanism the delta is built on.

### Rung 1 · Search — free

One TinyFish search for the state's own policy document, then a scoring pass that
prefers state domains and policy-shaped URLs:

| Signal | Score |
|---|---|
| `.gov` domain | +40 |
| URL or title mentions PDL / preferred drug / formulary / prior auth / criteria / fee schedule | +22 |
| URL contains `medicaid` | +18 |
| Title names the state | +10 |
| `.pdf` | +8 |
| Consumer drug sites, telehealth vendors, forums | −60 |

Nothing scoring at or below zero is fetched.

### Rung 2 · Fetch — free

The top three candidates go out in **one batched fetch call** — state portals are
full of thin landing pages that never name the drug, and a second and third try
costs nothing. Each result is windowed to the passages that mention the
condition's search terms, and a page whose window never mentions the drug is
treated as the **wrong page, not as evidence of non-coverage** — a distinction
that matters enormously for correctness.

The surviving excerpt goes to the cheap model with a strict JSON schema. If a
baseline row exists it is passed as *context, not evidence*: the state's own
document outranks a national tracker, and the model is told to contradict the
tracker only when the excerpt is clear.

### Rung 3 · Agent — metered, budgeted

Only when fetch came back empty — which for state Medicaid portals usually means
a 403 — and only when the orchestrator's `agentBudget` has runs left and the
baseline has not already answered with high confidence.

A TinyFish browser agent with the **stealth profile and a US proxy** re-reads the
page and returns the same JSON shape. `COMPLETED` only means the browser ran
without crashing, so the result is validated on content: `found === false` is
discarded and the ladder falls through.

### Fallbacks

If no rung produced evidence, the subagent falls back to the baseline row with
confidence knocked down a notch and a note saying the state's own publication did
not corroborate it. If there is no baseline row either, it returns `unpublished`
— a real finding, but also the gap the backfill pass exists to attack before the
scan settles on it.

### Leads

Everything the subagent *does not* read is banked. Search results it never
fetched, and every outbound link on every page it did fetch — including the wrong
pages. State sites are shaped so this pays: a preferred-drug-list index names no
drugs but links to the dated PDF that does, and a provider-bulletin index links
to the announcement saying what changed and when. Fetching only the top search
result and giving up is how a scanner concludes "no published policy" about a
state whose policy was one hop away.

### Dated versions

Extraction asks for more than the current rule. `otherVersions` captures any
**dated earlier or later version** the document describes — a bulletin announcing
a change almost always states what the rule was before it, and a superseded drug
list carries the date it stopped applying. Those become `PolicyVersion` entries
on the record's `history`, and [phase 5](#phase-5--derive-and-persist) turns
adjacent pairs into change events. This is what lets a **first** scan show a
timeline instead of a flat snapshot.

### One consistency rule

Extraction can contradict itself: a record marked `covered` with a
`prior_authorization` flag is incoherent. The flags are the more specific
evidence, so they win and the status is promoted to `conditional`.

## Phase 3b · Backfill

`agent/phases/backfill.ts` — up to five rounds, each spending one batched fetch.

The fan-out gives every state one honest attempt. That leaves a tail: states
whose portal returned a landing page, states with a status but no date, states
with a date but no criteria language, states where nothing was found at all.
Stopping there produces a map full of grey cells, and grey cells are the least
useful thing a fifty-state scan can output.

So this pass works the gap list until it is empty or the budget closes. A gap is
one of:

| Gap | Meaning |
|---|---|
| `no_policy_found` | Status is `unpublished` — nothing established |
| `no_source` | No citation |
| `no_timestamp` | Neither an effective date nor a document date |
| `no_criteria` | Neither verbatim language nor a summary |

Worst-first, so a limited budget lands where it changes the map most. Two things
make it cheap enough to be worth doing:

**Leads.** Following a banked lead costs a fetch, not a search. The fan-out
already paid for the pages that produced them.

**Batching.** Up to ten leads across ten *different states* go out in **one**
fetch call. Under a two-hundred-call ceiling, the difference between one call per
state and one call per ten states is the difference between finishing and
running out.

Queries here are deliberately a different shape from the fan-out's. The fan-out
asked "what is the rule?"; backfill asks "when did it change?" — because a dated
bulletin answers both at once and is the only way a first scan produces history.

Results **merge** rather than replace: a bulletin that dates the policy must not
erase criteria language an earlier read captured, and a thin gap-filling read is
never allowed to downgrade a state already answered from its own publication.

## Phase 4 · Changes

`agent/phases/changes.ts` — three news-domain searches (free), one smart call.

Three independent sources of delta, and every event says which it is:

- **`observed`** — our own snapshot differ. Ground truth: we held the same fifty
  sources at two points in time and compared them. Only available once a
  condition has been scanned twice.
- **`historical`** — two dated versions of the state's *own* policy, read during
  this scan and compared. Stronger than a headline, weaker than having watched it
  ourselves. This is what makes a first scan useful.
- **`reported`** — a dated public announcement found by news search.

The extraction prompt rejects hard: commercial-insurer news, Medicare-only news,
drug approvals, price changes, opinion pieces, and anything that only speculates
about what a state might do. A headline saying a state is "considering" something
is not an event.

Events are keyed `state-direction-date` so a re-scan that re-reads the same
announcement updates rather than duplicates it.

## Phase 5 · Derive and persist

Pure code, no model calls. The differ compares the previous snapshot to this one,
friction and outliers are computed, and the snapshot is written as a new
immutable file. See [DATA-MODEL.md](DATA-MODEL.md) for the maths and the storage
layout.

## Budgets and termination

`agent/lib/budget.ts`.

A scanner that follows leads out of the pages it reads and keeps digging until
every gap is closed will run forever on a condition whose sources are thin. Two
ceilings bound it:

| Ceiling | Default | What it bounds |
|---|---:|---|
| TinyFish calls | **200** | External spend and wall-clock. Every search, fetch and browser run counts. |
| Orchestrator steps | **80** | The *shape* of the work — a source read, a state processed, a backfill round. Stops a cheap-but-endless loop slipping past the call cap. |
| Browser runs | 6 | The metered rung, capped separately inside the call budget. |

Reservations are **all-or-nothing**: a phase that cannot afford its whole batch
skips it rather than partially spending, because a half-issued batch is harder to
account for than one never issued. Phases size themselves to `callsLeft`, so
change discovery running last takes whatever is left rather than failing.

**The scan stops when either ceiling binds, or — the good ending — when every
jurisdiction has a timestamped policy with a citation.** In that case it stops
early and reports `stoppedBecause: "complete"`, leaving budget unspent. There is
nothing left worth buying.

### After the cap

Running out is not a failure. Anything still unresolved goes to one final
`smart`-tier call that fills it from the model's own knowledge and marks it:

- `method: "inferred"` — the only method not backed by a source document
- `confidence: "review_needed"`
- no source URL
- a note stating the budget closed before the state was resolved, plus the
  model's own statement of what its estimate rests on

The UI labels these **unverified** in the matrix, banners them in the drawer, and
never lets them be mistaken for sourced records. The reasoning: a grey cell tells
a provider nothing, while a cell reading "probably prior authorization, not
verified, review before relying on it" is genuinely more useful — *provided* the
interface never blurs which is which.

## Token economics

The savings are structural, not a prompt trick. In rough order of size, for a
`standard` scan of one condition:

| Mechanism | Effect |
|---|---|
| **Shared tracker read** | One normalisation call answers 35–45 jurisdictions instead of 35–45 calls |
| **Plan only fans out the residue** | Confidently-answered states get no per-state call at all |
| **Evidence hashing** | On a re-scan, unchanged states cost zero — typically the large majority |
| **Windowing** | A 60–120k character preferred drug list becomes ~5k of relevant passages |
| **Narrow subagent context** | ~2k tokens per state instead of a conversation accumulating all 51 |
| **Two-tier routing** | 3–4 smart calls; all the volume on the cheap tier |
| **Batched backfill** | Ten states' gap-filling leads in one fetch call, not ten |

Windowing deserves the concrete version. A state preferred drug list is tables
for hundreds of drugs; the eight passages that mention semaglutide are a small
fraction of it. Sending whole documents to a model fifty-one times is precisely
how a naive scanner burns a million prompt tokens on a single condition.

**Every run measures this.** The ledger tracks actual prompt tokens alongside
`naivePromptTokensEstimate` — the counterfactual cost of sending each fetched
document to a model once per state — and reports the ratio in the run console
and in `pnpm agent:ledger`. A claim about efficiency that isn't measured is just
a claim.

```
run run_m1x8k2 · 84.3s · stopped because every jurisdiction answered
budget: 96/200 tinyfish calls, 63/80 steps
tinyfish: 47 searches, 18 fetches, 2 agent runs
llm: 21 calls, 148,220 prompt + 19,455 completion tokens
  smart=anthropic/claude-sonnet-4.5  cheap=google/gemini-2.5-flash
plan: 38 from baseline, 0 short-circuited, 2 escalated to browser
gaps: 6 closed by backfill, 0 inferred after the budget closed
history: 9 change events derived from dated versions found in this scan
saved ~1,214,900 prompt tokens vs a whole-document-per-state loop (9.2x)
no errors
```

*(Shape of the output; your numbers will differ by condition and source quality.)*

## Model routing

`agent/lib/llm.ts` routes to two tiers, both on OpenRouter:

| Tier | Default | Used for | Calls per scan |
|---|---|---|---|
| `smart` | `anthropic/claude-sonnet-4.5` | Resolution, tracker normalisation, change narration | 3–4 |
| `cheap` | `google/gemini-2.5-flash` | Source ranking, per-state extraction | 1 per fanned-out state |

The split is deliberate. Planning, source ranking and change narration are
judgement calls that a small model gets wrong in ways that are expensive to
notice — a mis-resolved condition wastes the whole scan, a hallucinated change
event is a false alert to a user. Per-state extraction against a pre-windowed
excerpt is mechanical transcription, and that is where the volume is.

All calls use OpenRouter structured outputs with `strict: true` JSON schemas,
temperature 0, and defensive fence-stripping for providers that wrap strict JSON
in a code fence anyway.

Override either tier by environment variable — see [OPERATIONS.md](OPERATIONS.md).

## Tuning

| Knob | CLI | API | Default | Effect |
|---|---|---|---|---|
| Depth | `--depth` | `depth` | `standard` | How many states get their own subagent |
| TinyFish ceiling | `--max-calls` | `limits.maxTinyfishCalls` | `200` | Hard cap on all searches, fetches and browser runs |
| Step ceiling | `--max-steps` | `limits.maxSteps` | `80` | Hard cap on orchestrator work items |
| Metered budget | `--agent-budget` | `agentBudget` | `6` | Ceiling on stealth browser runs per scan |
| Concurrency | `--wave` | — | `5` | Subagents in flight; matches TinyFish plan-based limits |
| Change window | `--change-window` | — | `365` days | How far back the news search looks |

Raising `--wave` past your TinyFish plan's concurrency limit produces throttling,
not speed. Raising `--agent-budget` is the only knob that meaningfully increases
spend, since search and fetch are free.

## Extending it

**A new escalation rung** (say, a PDF layout-aware extractor between fetch and
agent) goes in `subagent.ts` between rungs 2 and 3, and adds a value to
`CoverageRecord["method"]` plus a label in `lib/atlas.ts`.

**A new friction gate** goes in three places: the `FrictionFlag` union and
`FRICTION_WEIGHTS` in `agent/lib/types.ts`, `FRICTION_LABELS` for display, and
the `FLAGS` enum arrays in `baseline.ts` and `subagent.ts` that constrain the
JSON schemas. Weights are additive before squashing — see
[DATA-MODEL.md](DATA-MODEL.md#the-access-friction-index).

**A different program** (managed care, Medicare) means widening
`CoverageRecord["program"]` and relaxing the store's one-record-per-state
assumption. `unique(condition, state, program)` is the natural key; today only
`medicaid_ffs` is populated.
