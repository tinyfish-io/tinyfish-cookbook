// The orchestrator.
//
// It owns the plan, the budget and the merge; it does not own any extraction.
// Its whole job is to decide how little work the scan can get away with and
// still be right, then to hand each remaining piece to a subagent that knows
// nothing except its own state.
//
// The shape of the saving, in order of size:
//
//   1. One tracker read answers most of the country. Discovery is biased toward
//      documents that address many states at once precisely so that a single
//      normalisation call settles thirty-five to forty-five jurisdictions.
//   2. Only the residue is fanned out. States the baseline answered with high
//      confidence never get a per-state call at all.
//   3. Evidence hashing makes re-scans nearly free. A state whose source document
//      has not changed since the last scan costs zero model tokens.
//   4. Windowing cuts each remaining document from ~25k tokens to ~2k before a
//      model ever sees it.
//   5. Two-tier routing: the handful of judgement calls go to the strong model,
//      the volume of mechanical transcription goes to the cheap one.
//
// The ledger at the end of every run reports what this actually saved against a
// naive whole-document-per-state loop, because a claim about efficiency that
// isn't measured is just a claim.

import { ledger, modelFor } from "./lib/llm"
import {
  changesFromHistory,
  diffSnapshots,
  findOutliers,
  frictionIndex,
  gapsFor,
  isRecordComplete,
  sortHistory,
} from "./lib/derive"
import { Budget, DEFAULT_LIMITS, type BudgetLimits } from "./lib/budget"
import { LeadPool } from "./lib/leads"
import {
  appendRun,
  getCondition,
  listConditions,
  mergeChanges,
  readSnapshot,
  saveCondition,
  writeSnapshot,
  writesAreEphemeral,
} from "./lib/store"
import {
  STATES,
  STATE_FIPS,
  STATE_NAMES,
  type ConditionSpec,
  type CoverageRecord,
  type RunLedger,
  type Snapshot,
} from "./lib/types"
import { resolveCondition } from "./phases/resolve"
import { discoverSources } from "./phases/discover"
import { buildBaseline, type BaselineRow } from "./phases/baseline"
import { runSubagent } from "./phases/subagent"
import { backfill, inferRemaining } from "./phases/backfill"
import { discoverReportedChanges } from "./phases/changes"

export type ScanEvent =
  | { type: "phase"; phase: string; note: string }
  | { type: "condition"; spec: ConditionSpec }
  | { type: "plan"; total: number; fromBaseline: number; toFanOut: number }
  | { type: "state"; record: CoverageRecord; done: number; total: number }
  | { type: "changes"; observed: number; historical: number; reported: number }
  /** Budget pressure, so the console can show how much room is left. */
  | { type: "budget"; tinyfishCalls: number; maxTinyfishCalls: number; steps: number; maxSteps: number }
  | { type: "complete"; snapshotStamp: string; ledger: RunLedger; outliers: ReturnType<typeof findOutliers> }
  | { type: "error"; message: string }

export type ScanOptions = {
  /** Free text from the user, or the slug of a saved condition. */
  condition: string
  /**
   * baseline — trackers only. Seconds, near-free, thinner criteria.
   * standard — fan out to whatever the baseline left thin. The default.
   * deep     — fan out to all 51 regardless. Slowest, best verbatim coverage.
   */
  depth?: "baseline" | "standard" | "deep"
  /** Ceiling on metered browser runs. The only rung of the ladder that costs money. */
  agentBudget?: number
  /** Concurrency. Waves of 5 matches TinyFish's plan-based limits. */
  waveSize?: number
  changeWindowDays?: number
  /** Hard ceilings. Defaults: 200 TinyFish calls, 80 orchestrator steps. */
  limits?: Partial<BudgetLimits>
  onEvent?: (event: ScanEvent) => void
}

const ALL_STATES = STATES.map(([, , code]) => code)

export async function scan(opts: ScanOptions): Promise<{ snapshot: Snapshot; ledger: RunLedger }> {
  const depth = opts.depth ?? "standard"
  const waveSize = opts.waveSize ?? 5
  const budget = new Budget({
    ...DEFAULT_LIMITS,
    ...opts.limits,
    maxAgentRuns: opts.agentBudget ?? opts.limits?.maxAgentRuns ?? DEFAULT_LIMITS.maxAgentRuns,
  })
  const leads = new LeadPool()
  const emit = (e: ScanEvent) => opts.onEvent?.(e)
  const emitBudget = () => emit({ type: "budget", ...budget.snapshot() })
  const startedAt = new Date().toISOString()
  const t0 = Date.now()
  ledger.reset()

  const run: RunLedger = {
    runId: `run_${t0.toString(36)}`,
    conditionSlug: "",
    startedAt,
    finishedAt: null,
    durationMs: 0,
    tinyfishSearches: 0,
    tinyfishFetches: 0,
    tinyfishAgentRuns: 0,
    llmCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    statesFromBaseline: 0,
    statesShortCircuited: 0,
    statesEscalated: 0,
    naivePromptTokensEstimate: 0,
    statesBackfilled: 0,
    statesInferred: 0,
    historicalChanges: 0,
    budget: budget.snapshot(),
    errors: [],
  }

  try {
    // Phase 0 — resolve. A saved condition skips the model call entirely.
    budget.spendStep()
    if (writesAreEphemeral) {
      // Say this up front rather than letting someone discover it after a
      // five-minute scan: on a serverless host the only writable path is /tmp,
      // so results live for the life of the instance and no longer.
      emit({
        type: "phase",
        phase: "resolve",
        note: "This host has a read-only filesystem — results will show live but are not persisted beyond this instance",
      })
    }
    emit({ type: "phase", phase: "resolve", note: `Interpreting "${opts.condition}"` })
    const saved = (await getCondition(opts.condition)) ?? (await matchSaved(opts.condition))
    const spec = saved ?? (await resolveCondition(opts.condition))
    run.conditionSlug = spec.slug
    await saveCondition(spec)
    emit({ type: "condition", spec })
    emit({ type: "phase", phase: "resolve", note: `${spec.name} · ${spec.treatmentClass} — ${spec.policyLever}` })

    const previous = await readSnapshot(spec.slug)
    const prior = new Map((previous?.records ?? []).map((r) => [r.state, r]))

    // Phase 1 — discover sources.
    budget.spendStep()
    emit({ type: "phase", phase: "discover", note: "Searching for multi-state policy trackers" })
    const discovery = await discoverSources(spec, budget, leads, (n) =>
      emit({ type: "phase", phase: "discover", note: n }),
    )
    run.tinyfishSearches += discovery.searches
    emitBudget()

    // Phase 2 — one read, fifty answers.
    budget.spendStep()
    emit({ type: "phase", phase: "baseline", note: "Reading trackers" })
    const baseline = await buildBaseline(spec, discovery.sources, previous?.records ?? [], budget, (n) =>
      emit({ type: "phase", phase: "baseline", note: n }),
    )
    run.tinyfishFetches += baseline.fetches
    run.naivePromptTokensEstimate += baseline.naiveTokens
    emitBudget()

    // Plan: which states still need their own subagent.
    const needsWork = ALL_STATES.filter((code) => {
      if (depth === "deep") return true
      if (depth === "baseline") return false
      const row = baseline.rows.get(code)
      return !row || row.confidence !== "high" || !row.criteriaVerbatim
    })
    const settled = ALL_STATES.filter((c) => !needsWork.includes(c))
    run.statesFromBaseline = settled.length
    emit({ type: "plan", total: ALL_STATES.length, fromBaseline: settled.length, toFanOut: needsWork.length })
    emit({
      type: "phase",
      phase: "plan",
      note: `${settled.length} jurisdictions settled by the shared read; ${needsWork.length} go to per-state subagents`,
    })

    const records = new Map<string, CoverageRecord>()
    let done = 0
    const land = (record: CoverageRecord) => {
      records.set(record.state, record)
      done = records.size
      emit({ type: "state", record, done, total: ALL_STATES.length })
    }

    // States the baseline settled: promote the row straight to a record.
    for (const code of settled) {
      const row = baseline.rows.get(code)
      land(row ? rowToRecord(code, row) : unpublishedRecord(code, spec.treatmentClass))
    }

    // Phase 3 — fan out. Waves of `waveSize`, isolated per state, failures contained.
    emit({ type: "phase", phase: "fanout", note: `Fanning out ${needsWork.length} states in waves of ${waveSize}` })
    for (let i = 0; i < needsWork.length; i += waveSize) {
      if (budget.exhausted) {
        emit({
          type: "phase",
          phase: "fanout",
          note: `Budget ceiling reached (${budget.stopReason.replace("_", " ")}) — ${needsWork.length - i} states left to the backfill and inference passes`,
        })
        break
      }
      const wave = needsWork.slice(i, i + waveSize)
      budget.spendStep(wave.length)
      const results = await Promise.allSettled(
        wave.map((code) =>
          runSubagent({
            state: code,
            spec,
            baseline: baseline.rows.get(code),
            prior: prior.get(code),
            budget,
            leads,
            onProgress: (note) => emit({ type: "phase", phase: "fanout", note }),
          }),
        ),
      )
      for (let j = 0; j < results.length; j++) {
        const code = wave[j]
        const settledResult = results[j]
        let record: CoverageRecord
        if (settledResult.status === "fulfilled") {
          const out = settledResult.value
          record = out.record
          run.tinyfishSearches += out.searches
          run.tinyfishFetches += out.fetches
          run.tinyfishAgentRuns += out.agentRuns
          run.naivePromptTokensEstimate += out.naiveTokens
          if (out.shortCircuited) run.statesShortCircuited++
          if (out.agentRuns > 0) run.statesEscalated++
        } else {
          // One state failing must never cost us the other fifty.
          run.errors.push(`${code}: ${String(settledResult.reason).slice(0, 160)}`)
          const row = baseline.rows.get(code)
          record = row ? rowToRecord(code, row) : (prior.get(code) ?? unpublishedRecord(code, spec.treatmentClass))
        }
        land(record)
      }
      emitBudget()
    }

    // Any state the fan-out never reached still needs a row on the map.
    for (const code of ALL_STATES) {
      if (!records.has(code)) {
        const row = baseline.rows.get(code)
        land(row ? rowToRecord(code, row) : (prior.get(code) ?? unpublishedRecord(code, spec.treatmentClass)))
      }
    }

    // Phase 3b — go back for the gaps, following banked leads, until the list is
    // empty or the budget closes. This is the difference between a map with grey
    // holes and one where every jurisdiction carries a timestamped, cited answer.
    const incomplete = [...records.values()].filter((r) => !isRecordComplete(r))
    if (incomplete.length > 0 && !budget.exhausted && depth !== "baseline") {
      budget.spendStep()
      emit({
        type: "phase",
        phase: "backfill",
        note: `${incomplete.length} jurisdictions incomplete · ${leads.size} leads banked from pages already read`,
      })
      const filled = await backfill({
        spec,
        records,
        budget,
        leads,
        maxRounds: 5,
        onProgress: (note) => emit({ type: "phase", phase: "backfill", note }),
        onRecord: (record) => land(record),
      })
      run.statesBackfilled = filled.filled
      run.tinyfishSearches += filled.searches
      run.tinyfishFetches += filled.fetches
      run.naivePromptTokensEstimate += filled.naiveTokens
      emit({
        type: "phase",
        phase: "backfill",
        note: `${filled.filled} gaps closed · ${filled.remainingGaps.length} jurisdictions still incomplete`,
      })
      emitBudget()
    }

    // Termination. Either every jurisdiction is answered — the good ending, and
    // we stop before spending the rest of the budget — or a ceiling bound, and
    // whatever is still missing gets filled from model knowledge and flagged.
    const stillMissing = [...records.values()].filter((r) => gapsFor(r).includes("no_policy_found"))
    if (stillMissing.length === 0) {
      budget.markComplete()
      emit({
        type: "phase",
        phase: "plan",
        note: `Every jurisdiction answered with a source and a timestamp — stopping at ${budget.tinyfishCalls}/${budget.limits.maxTinyfishCalls} calls`,
      })
    } else {
      run.statesInferred = await inferRemaining(spec, records, (note) =>
        emit({ type: "phase", phase: "infer", note }),
      )
      for (const record of records.values()) if (record.method === "inferred") land(record)
    }

    const allRecords = ALL_STATES.map((c) => records.get(c)!).filter(Boolean)
    for (const record of allRecords) record.history = sortHistory(record.history ?? [])

    // Phase 4 — the delta, from three independent directions.
    emit({ type: "phase", phase: "changes", note: "Computing deltas and searching for dated announcements" })
    const observed = previous ? diffSnapshots(previous.records, allRecords, new Date().toISOString()) : []
    const historical = changesFromHistory(allRecords, new Date().toISOString())
    run.historicalChanges = historical.length
    let reported: Awaited<ReturnType<typeof discoverReportedChanges>> = { events: [], searches: 0 }
    try {
      reported = await discoverReportedChanges(spec, opts.changeWindowDays ?? 365, budget, (n) =>
        emit({ type: "phase", phase: "changes", note: n }),
      )
      run.tinyfishSearches += reported.searches
    } catch (err) {
      run.errors.push(`reported changes: ${String(err).slice(0, 160)}`)
    }
    // Merge order matters: later entries win on an id collision, and an event we
    // observed ourselves outranks one we merely read about.
    const changes = await mergeChanges(spec.slug, [...reported.events, ...historical, ...observed])
    emit({ type: "changes", observed: observed.length, historical: historical.length, reported: reported.events.length })

    // Phase 5 — write the snapshot and close the ledger.
    run.llmCalls = ledger.calls
    run.promptTokens = ledger.promptTokens
    run.completionTokens = ledger.completionTokens
    run.budget = budget.snapshot()
    run.durationMs = Date.now() - t0
    run.finishedAt = new Date().toISOString()

    const snapshot: Snapshot = {
      conditionSlug: spec.slug,
      scannedAt: run.finishedAt,
      records: allRecords,
      sources: [...baseline.used, ...discovery.sources.filter((s) => !baseline.used.some((u) => u.url === s.url)).slice(0, 4)],
      ledger: run,
    }
    const stamp = await writeSnapshot(snapshot)
    await appendRun(run)

    emit({ type: "complete", snapshotStamp: stamp, ledger: run, outliers: findOutliers(allRecords, changes) })
    return { snapshot, ledger: run }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    run.errors.push(message)
    run.budget = budget.snapshot()
    run.durationMs = Date.now() - t0
    run.finishedAt = new Date().toISOString()
    await appendRun(run)
    emit({ type: "error", message })
    throw err
  }
}

/** Let "obesity" find a saved condition named "Obesity" without paying for a resolve call. */
async function matchSaved(input: string): Promise<ConditionSpec | null> {
  const needle = input.trim().toLowerCase()
  if (needle.length < 3) return null
  const all = await listConditions()
  return (
    all.find((c) => c.name.toLowerCase() === needle || c.userInput.trim().toLowerCase() === needle) ?? null
  )
}

function rowToRecord(code: string, row: BaselineRow): CoverageRecord {
  const flags = row.frictionFlags as CoverageRecord["frictionFlags"]
  const status = row.status === "covered" && flags.includes("prior_authorization") ? "conditional" : row.status
  const friction = frictionIndex(status, flags)
  return {
    state: code,
    stateName: STATE_NAMES[code],
    fips: STATE_FIPS[code],
    program: "medicaid_ffs",
    status,
    authorization: flags.includes("step_therapy")
      ? "step_therapy"
      : flags.includes("prior_authorization")
        ? "prior_authorization"
        : "none",
    frictionFlags: flags,
    frictionIndex: friction,
    accessScore: status === "not_covered" || status === "unpublished" ? 0 : Math.max(0, 100 - friction),
    criteriaSummary: row.criteriaSummary,
    criteriaVerbatim: row.criteriaVerbatim,
    administeringEntity: null,
    sourceDoc: row.sourceDoc,
    sourceUrl: row.sourceUrl,
    effectiveDate: row.effectiveDate,
    confidence: row.confidence,
    method: "baseline",
    lastCheckedAt: new Date().toISOString(),
    documentDate: row.effectiveDate,
    history: [
      {
        status,
        authorization: flags.includes("step_therapy")
          ? "step_therapy"
          : flags.includes("prior_authorization")
            ? "prior_authorization"
            : "none",
        frictionFlags: flags,
        frictionIndex: friction,
        criteriaSummary: row.criteriaSummary,
        criteriaVerbatim: row.criteriaVerbatim,
        effectiveDate: row.effectiveDate,
        documentDate: row.effectiveDate,
        sourceDoc: row.sourceDoc,
        sourceUrl: row.sourceUrl,
        isCurrent: true,
        discoveredAt: new Date().toISOString(),
      },
    ],
    evidenceHash: null,
    notes: null,
  }
}

function unpublishedRecord(code: string, treatmentClass: string): CoverageRecord {
  return {
    state: code,
    stateName: STATE_NAMES[code],
    fips: STATE_FIPS[code],
    program: "medicaid_ffs",
    status: "unpublished",
    authorization: "none",
    frictionFlags: [],
    frictionIndex: 92,
    accessScore: 0,
    criteriaSummary: `No published fee-for-service policy for ${treatmentClass} was found in this scan.`,
    criteriaVerbatim: null,
    administeringEntity: null,
    sourceDoc: null,
    sourceUrl: null,
    effectiveDate: null,
    confidence: "review_needed",
    method: "search",
    lastCheckedAt: new Date().toISOString(),
    documentDate: null,
    history: [],
    evidenceHash: null,
    notes: null,
  }
}

export function ledgerSummary(run: RunLedger): string {
  const saved = run.naivePromptTokensEstimate - run.promptTokens
  const ratio = run.promptTokens > 0 ? run.naivePromptTokensEstimate / run.promptTokens : 0
  // Ledgers written before budgets existed have no `budget`; the run log is an
  // append-only file that outlives schema changes, so read it defensively.
  const budget = run.budget ?? {
    tinyfishCalls: run.tinyfishSearches + run.tinyfishFetches + run.tinyfishAgentRuns,
    maxTinyfishCalls: 0,
    steps: 0,
    maxSteps: 0,
    stoppedBecause: "complete" as const,
  }
  const stopped =
    budget.stoppedBecause === "complete"
      ? "every jurisdiction answered"
      : budget.stoppedBecause === "call_cap"
        ? "TinyFish call ceiling reached"
        : "orchestrator step ceiling reached"
  return [
    `run ${run.runId} · ${(run.durationMs / 1000).toFixed(1)}s · stopped because ${stopped}`,
    `budget: ${budget.tinyfishCalls}/${budget.maxTinyfishCalls || "?"} tinyfish calls, ${budget.steps}/${budget.maxSteps || "?"} steps`,
    `tinyfish: ${run.tinyfishSearches} searches, ${run.tinyfishFetches} fetches, ${run.tinyfishAgentRuns} agent runs`,
    `llm: ${run.llmCalls} calls, ${run.promptTokens.toLocaleString()} prompt + ${run.completionTokens.toLocaleString()} completion tokens`,
    `  smart=${modelFor("smart")}  cheap=${modelFor("cheap")}`,
    `plan: ${run.statesFromBaseline} from baseline, ${run.statesShortCircuited} short-circuited, ${run.statesEscalated} escalated to browser`,
    `gaps: ${run.statesBackfilled ?? 0} closed by backfill, ${run.statesInferred ?? 0} inferred after the budget closed`,
    `history: ${run.historicalChanges ?? 0} change events derived from dated versions found in this scan`,
    `saved ~${saved.toLocaleString()} prompt tokens vs a whole-document-per-state loop (${ratio.toFixed(1)}x)`,
    run.errors.length ? `errors: ${run.errors.length}` : "no errors",
  ].join("\n")
}
