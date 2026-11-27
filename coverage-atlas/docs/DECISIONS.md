# Decisions

The calls that shaped this build, what each one bought, and what it cost. Written
so a reader can disagree with the reasoning rather than guess at it.

---

## 1. Friction, not status, is the unit of comparison

**Decision.** Extract the administrative gates a policy document states, derive
an Access Friction Index from them, and let the map colour by friction as well as
by status.

**Why.** "Is it covered?" is the question every existing tracker already answers,
and on its own it is close to useless. Two states can both say *covered* and be
forty points apart in what a patient faces — one requires prior authorization, a
documented failed trial, six months of a supervised program, a specialist
prescriber and quarterly reauthorization; the other puts it on the shelf. The
objective asked for contrast and delta; the contrast is only interesting if the
thing being contrasted is the thing that decides whether a patient gets treated.

**Cost.** The index is our construct. The weights are defensible but they are a
judgement, and a different set produces a different ordering. Mitigated by
keeping the derivation pure and open — the flags are extracted with citations,
the arithmetic is in one readable function, and anyone can recompute or reweight
it from `data/`.

**Alternative rejected.** Reporting gate counts without a score. Honest, but it
does not sort, so the map cannot show the thing worth showing.

---

## 2. The frontend's "Reimbursement %" became "Access friction"

**Decision.** Replace the reimbursement column that the original interface
sketched with the friction index.

**Why.** State Medicaid programs do not publish reimbursement rates in any
cross-state-comparable form. A "reimbursement %" column could only have been
fabricated, and fabricating the one number a provider might act on financially is
the worst thing this product could do.

**Cost.** A visible deviation from the original design. Flagged rather than
quietly substituted.

---

## 3. Conditions are free text, not a fixed menu

**Decision.** Any condition a user can name gets resolved, sourced and swept.
Nothing is hardcoded per condition.

**Why.** A demo with three baked-in conditions is a static scrape with a nicer
front end. The interesting claim is that the machinery generalises — and it
forces the architecture to be honest, because source discovery has to actually
work rather than being a lookup table.

**Cost.** Quality varies with how well-covered a condition is on the public web.
A condition with no good multi-state tracker degrades to a slow fan-out with more
`unpublished` results. The resolution phase's `policyLever` field is the guard:
it says up front whether states are even permitted to differ.

---

## 4. Orchestrator plans; subagents extract; neither does the other's job

**Decision.** A subagent receives one state, its spec, one baseline row and its
own prior record. It never sees its siblings, the tracker document, or the
orchestrator's reasoning.

**Why.** Nothing about Ohio's job requires knowing anything about Nevada. A
shared conversation accumulating all fifty-one states would grow quadratically
and buy no accuracy. Keeping each worker's context around two thousand tokens is
where most of the token saving comes from, and it also makes failures local — one
state failing cannot corrupt the others.

**Cost.** Cross-state consistency has to be imposed by the orchestrator and the
derivation layer rather than emerging from a model seeing everything at once. In
practice this is a feature: consistency by arithmetic is checkable, consistency
by vibes is not.

---

## 5. Escalation ladder, cheapest rung first

**Decision.** `carry-forward → search → fetch → stealth agent`, stopping at the
first rung that answers, with the metered rung capped by a per-scan budget.

**Why.** Search and fetch are free; browser agents are not. Most states are
answerable from a fetched document. The browser exists for the ones whose portals
403 plain fetchers — which is real and common — not as the default tool.

**Cost.** More code than "run an agent on every state", and more failure modes to
handle. Worth it: the metered rung typically fires for a handful of states rather
than fifty-one.

---

## 6. Immutable JSON snapshots on disk, not Postgres

**Decision.** Every scan appends a file. Deltas are computed by reading two.

**Why.** The delta is the product, so history has to be first-class rather than a
mutable current-row that overwrites what it replaces. Files also mean the demo
opens with complete committed data and zero infrastructure, and every derived
number is reproducible by anyone with the repo.

**Cost.** No concurrent writers, no query language, no indexes. Fine at
51 records × a few conditions × a few snapshots; not fine at national scale with
many users. The schema in the reference skeleton (`coverage_records`,
`change_events`, `scan_runs`) is the right shape when it outgrows this, and the
types map onto it directly.

**One exception.** `patchLatestRecord`, used only by "check again now". A live
re-verification observes the *current* world, so it belongs in the current
snapshot; a new snapshot containing one refreshed state would corrupt the differ.

---

## 7. Two-tier model routing

**Decision.** Resolution, tracker normalisation and change narration go to a
strong model — three or four calls. Source ranking and per-state extraction go to
a cheap one — all the volume.

**Why.** The volume work is mechanical transcription against a pre-windowed
excerpt, which small models do well. The judgement work fails in ways that are
expensive to notice: a mis-resolved condition wastes an entire scan, a
hallucinated change event is a false alert to a user making a clinical decision.

**Cost.** Two models to keep working. Both are environment variables, and the
schemas are strict, so swapping either is a one-line change.

---

## 8. Stability rules against classifier flapping

**Decision.** The baseline prompt receives the statuses we already hold and keeps
them unless the document plainly contradicts them; the differ ignores friction
movements under six points.

**Why.** Every reported change is published as an alert. A model that resolves a
borderline "covered vs covered-with-limits" call differently on Tuesday than on
Monday manufactures a policy change that never happened. A scanner that cries
wolf is worse than no scanner.

**Cost.** A genuine but subtle real change may take an extra scan to surface.
That is the right side to err on for this product. (This rule is inherited from
the reference skeleton, which had it right.)

---

## 9. Provenance is stated on every change event

**Decision.** Every event is labelled `observed` (our own snapshot diff) or
`reported` (a dated public announcement), in the data and in the UI.

**Why.** "We watched this happen" and "we read that this happened" are different
claims. A first scan can only produce the second kind; conflating them would
overstate what the scanner has actually verified.

**Cost.** A first scan's change feed looks thinner than it could if we blurred
the distinction. Correct.

---

## 10. `unpublished` is a finding, not a failure

**Decision.** A state with no findable published fee-for-service policy is
recorded as `unpublished` with `review_needed` confidence, scoring 92 friction —
not as `not_covered`, and not omitted.

**Why.** Several states genuinely publish no FFS policy and leave the decision to
managed-care plans. That is materially different from a refusal, and it is
information a provider needs. Silently dropping such states would also make the
map lie by omission.

**Cost.** A scan with poor source coverage looks worse than one that guessed.
That is the point.

---

## 11. Fee-for-service only

**Decision.** Scope to Medicaid FFS. Stated in the UI and the README rather than
implied.

**Why.** Roughly three quarters of Medicaid enrollees are in managed care, and
MCOs layer their own criteria on top. FFS is the published floor — real,
comparable across states, and the only tier with documents to read. Claiming to
represent total coverage would be false.

**Cost.** Incomplete for a large share of actual patients. The data model already
carries `program`, so managed care is an extension rather than a rewrite.

---

## 12. Two ceilings, and finishing early is a legitimate ending

**Decision.** Bound every scan at 200 TinyFish calls and 80 orchestrator steps.
Stop early, with budget unspent, when every jurisdiction has a timestamped,
cited answer.

**Why.** A scanner that follows leads out of the pages it reads and keeps digging
until every gap closes will run forever on a condition whose sources are thin.
Two ceilings, not one, because they bound different things: calls bound external
spend and wall-clock, steps bound the *shape* of the work, so a cheap-but-endless
loop cannot slip past the call cap. And the early stop matters as much as the
ceilings — a scan that spends its whole budget because the budget was there is
wasting money on a map that was already finished.

**Cost.** Two numbers to tune per condition, and a condition with genuinely
scattered sources can hit a ceiling with states unresolved. That is what
decision 13 is for.

---

## 13. After the cap, infer — and mark it, loudly

**Decision.** Jurisdictions still unresolved when the budget closes are filled
from the model's own knowledge, as `method: "inferred"`, `review_needed`
confidence, no source URL, and a note stating what the estimate rests on. The
matrix labels them *unverified*, the drawer banners them.

**Why.** A grey cell tells a provider nothing at all. A cell reading "probably
prior authorization, not verified against a source, review before relying on it"
is genuinely more useful. The entire value of that trade depends on the interface
never letting the two be confused, so the marking is not decoration — it is the
condition under which the feature is acceptable.

**Cost.** A record on the map that is not backed by a document, in a product
whose whole pitch is that every record carries its citation. Fenced off as hard
as the type system allows: `inferred` is the only `method` value with no source,
and it is checked explicitly wherever records render.

**Alternative rejected.** Leaving them `unpublished`. Honest, but it conflates
"this state publishes nothing" with "we ran out of budget", which are completely
different facts and were being rendered identically.

---

## 14. Record dated policy versions, not just the current rule

**Decision.** Extraction asks for any dated earlier or later version a document
describes. Those become `history` on the record, and adjacent pairs become change
events marked `historical`.

**Why.** Snapshot-to-snapshot diffing is the strongest evidence of change, but it
needs two scans — so a first scan could say nothing about the delta, which is the
product's entire thesis. Medicaid documents are full of dated self-reference: a
bulletin announcing a change states the rule it replaces. Reading that turns one
scan into a timeline.

**Cost.** A larger extraction schema and more completion tokens per state, and
the versions are only as good as the document's own account of its history. The
third provenance value exists precisely so this is never passed off as something
we watched happen.

---

## 15. Bank every URL the scan does not read

**Decision.** Search results not fetched, and outbound links from every page
fetched — including the wrong pages — go into a scored, deduplicated lead pool
that the backfill pass spends.

**Why.** State sites are shaped so that the answer is usually one hop from the
page a search returns. The preferred-drug-list index names no drugs but links to
the dated PDF that does. Fetching the top result and giving up is how a scanner
concludes "no published policy" about a state whose policy was one link away.
Following a banked lead costs a fetch, not a search — the fan-out already paid
for the page that produced it.

**Cost.** Link harvesting means requesting `links: true` on every fetch, and a
pool that has to be bounded so it does not grow without limit. Capped at 400
entries with the weakest dropped.

---

## 16. Backfill batches ten states into one fetch

**Decision.** Each backfill round assembles at most one URL per state across at
most ten states, and issues them as a single `fetchContents` call.

**Why.** Under a 200-call ceiling, one call per state and one call per ten states
is the difference between closing the gap list and running out at state twenty.

**Cost.** Attribution has to be done by matching `url`/`final_url` back to the
state that contributed it, and a batch fails as a batch. Acceptable: per-URL
failures come back in `errors[]` rather than throwing, so one bad URL does not
cost the other nine.

---

## 17. One line while scanning, the full log behind a button

**Decision.** During a scan the interface shows a single line — current phase,
current task, progress — under whatever the user was already looking at. The
complete agent log lives in a side panel opened from a header button.

**Why.** A console pinned to every page is noise on the four pages that are not
about scanning, and it competes with the map for exactly the attention the map
should be getting. While a scan runs the only live question is "what is it doing
right now, and how far along is it", and that fits on one line. Everything
else — phase history, budget pressure, the ledger — is diagnostic, wanted
occasionally, and belongs behind a deliberate click.

**Cost.** The efficiency story (how many states one shared read settled) is no
longer unmissable; it is one click away. The header button carries a live
progress count so the panel is discoverable while it still matters.

---

## 18. A hand-written TinyFish client over the documented HTTP endpoints

**Decision.** `agent/lib/tinyfish.ts` calls the documented endpoints directly
rather than depending on `@tiny-fish/sdk`.

**Why.** The scanner runs both inside a Next.js route and as a standalone CLI.
One dependency-free module whose retry policy, timeouts and SSE line-buffering we
control is easier to reason about than two call paths, and every endpoint was
verified live before being wired in.

**Cost.** SDK improvements do not arrive for free, and enums (`BrowserProfile`,
`RunStatus`) are string literals here. The surface is small — three primitives —
so the maintenance burden is low.

---

## 19. Line-buffered SSE parsing on the client

**Decision.** Keep the partial trailing line between chunks rather than splitting
on `\n\n`.

**Why.** A chunk boundary lands mid-JSON often enough to drop roughly one state
per scan. A state silently missing from the map is the exact failure this product
cannot have — it looks like data, not like an error.
