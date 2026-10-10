// Phase 3b — go back for what is missing.
//
// The fan-out gives every state one honest attempt. That leaves a tail: states
// whose portal returned a landing page, states with a status but no date, states
// with a date but no criteria language, and states where nothing was found at
// all. Stopping there is what produces a map full of grey cells, and grey cells
// are the least useful thing a fifty-state scan can output.
//
// So this pass works the gap list until it is empty or the budget closes. Two
// things make it cheap enough to be worth doing:
//
//   Leads. Every search result the fan-out did not fetch and every outbound link
//   on every page it did fetch was banked. State sites are shaped so this pays:
//   the preferred-drug-list index names no drugs but links to the dated PDF that
//   does. Following a banked lead costs no search, only a fetch.
//
//   Batching. Up to ten leads across ten different states go out in ONE fetch
//   call. Under a two-hundred-call ceiling, the difference between one call per
//   state and one call per ten states is the difference between finishing and
//   running out.
//
// Queries here are deliberately different in shape from the fan-out's. The
// fan-out asked "what is the rule?"; backfill asks "when did it change?", because
// a dated bulletin answers both at once and is the only way a first scan can
// produce a timeline.

import { askJson } from "../lib/llm"
import { fetchContents, guessDocumentDate, search } from "../lib/tinyfish"
import { estimateTokens, frictionIndex, gapsFor, looksLikeWrongState, prioritiseGaps, sha256, windowText } from "../lib/derive"
import type { Budget } from "../lib/budget"
import type { LeadPool } from "../lib/leads"
import { STATE_NAMES, type ConditionSpec, type CoverageRecord, type RecordGap } from "../lib/types"
import { toRecord, type Extraction } from "./subagent"

const STATUSES = ["covered", "conditional", "limited", "not_covered", "unpublished"] as const
const FLAGS = [
  "prior_authorization", "step_therapy", "clinical_threshold", "prior_failure_required",
  "supervised_program", "specialist_prescriber", "quantity_limit", "short_renewal",
  "medical_benefit_only", "age_restriction", "diagnosis_restriction",
] as const

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "found", "status", "frictionFlags", "criteriaSummary", "criteriaVerbatim",
    "administeringEntity", "effectiveDate", "documentDate", "otherVersions", "confidence",
  ],
  properties: {
    found: { type: "boolean" },
    status: { type: "string", enum: STATUSES as unknown as string[] },
    frictionFlags: { type: "array", items: { type: "string", enum: FLAGS as unknown as string[] } },
    criteriaSummary: { type: ["string", "null"] },
    criteriaVerbatim: { type: ["string", "null"] },
    administeringEntity: { type: ["string", "null"] },
    effectiveDate: { type: ["string", "null"] },
    documentDate: { type: ["string", "null"] },
    otherVersions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["status", "frictionFlags", "effectiveDate", "note"],
        properties: {
          status: { type: "string", enum: STATUSES as unknown as string[] },
          frictionFlags: { type: "array", items: { type: "string", enum: FLAGS as unknown as string[] } },
          effectiveDate: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
        },
      },
    },
    confidence: { type: "string", enum: ["high", "moderate", "review_needed"] },
  },
} as const

export type BackfillInput = {
  spec: ConditionSpec
  records: Map<string, CoverageRecord>
  budget: Budget
  leads: LeadPool
  /** Rounds to attempt. Each round batches one fetch across up to ten states. */
  maxRounds?: number
  onProgress?: (note: string) => void
  onRecord?: (record: CoverageRecord) => void
}

export type BackfillOutcome = {
  filled: number
  searches: number
  fetches: number
  naiveTokens: number
  remainingGaps: { state: string; gaps: RecordGap[] }[]
}

/** History-shaped queries: a dated bulletin answers "what" and "when" together. */
function gapQueries(spec: ConditionSpec, stateName: string, gaps: RecordGap[]): string[] {
  const t = spec.treatmentClass
  if (gaps.includes("no_policy_found")) {
    return [
      `"${stateName}" Medicaid ${t} coverage policy ${spec.treatments[0] ?? ""} provider bulletin`,
      `${stateName} Medicaid preferred drug list ${t} pharmacy benefit`,
    ]
  }
  return [
    `${stateName} Medicaid ${t} policy update effective date bulletin 2025 2026`,
    `${stateName} Medicaid ${t} prior authorization criteria change announcement`,
  ]
}

export async function backfill(input: BackfillInput): Promise<BackfillOutcome> {
  const { spec, records, budget, leads } = input
  const terms = [...spec.searchTerms, ...spec.treatments.map((t) => t.toLowerCase())]
  const out: BackfillOutcome = { filled: 0, searches: 0, fetches: 0, naiveTokens: 0, remainingGaps: [] }
  const rounds = input.maxRounds ?? 4

  for (let round = 0; round < rounds; round++) {
    if (budget.exhausted) break

    const needy = prioritiseGaps([...records.values()])
    if (needy.length === 0) break
    input.onProgress?.(`backfill round ${round + 1}: ${needy.length} jurisdictions still incomplete`)

    // Assemble one batch: at most one URL per state, at most ten states.
    const batch: { state: string; url: string; title: string }[] = []
    const needSearch: CoverageRecord[] = []
    for (const record of needy) {
      if (batch.length >= 10) break
      const [lead] = leads.take(record.state, 1)
      if (lead) batch.push({ state: record.state, url: lead.url, title: lead.title })
      else needSearch.push(record)
    }

    // States with no banked lead get one targeted search, which refills the pool.
    for (const record of needSearch.slice(0, Math.max(0, 10 - batch.length))) {
      if (!budget.spendCalls(1)) break
      out.searches++
      const stateName = STATE_NAMES[record.state]
      const [query] = gapQueries(spec, stateName, gapsFor(record))
      try {
        const hits = await search(query)
        for (const hit of hits) leads.add(hit.url, hit.title, record.state, "search", stateName)
        const [lead] = leads.take(record.state, 1)
        if (lead) batch.push({ state: record.state, url: lead.url, title: lead.title })
      } catch {
        /* a state we cannot search for is a state we leave to the inference pass */
      }
    }

    if (batch.length === 0) break
    if (!budget.spendCalls(1)) break
    out.fetches++
    input.onProgress?.(`backfill round ${round + 1}: reading ${batch.length} leads in one batched fetch`)

    let docs
    try {
      docs = await fetchContents(batch.map((b) => b.url), 90_000)
    } catch (err) {
      input.onProgress?.(`backfill fetch failed: ${String(err).slice(0, 90)}`)
      continue
    }

    for (const doc of docs) {
      const entry = batch.find((b) => b.url === doc.url || b.url === doc.final_url)
      if (!entry) continue
      const record = records.get(entry.state)
      if (!record) continue
      const stateName = STATE_NAMES[entry.state]
      leads.addPageLinks(doc.links, entry.state, stateName)

      const text = doc.text ?? ""
      if (text.length < 400) continue
      out.naiveTokens += estimateTokens(text)
      const windowed = windowText(text, terms, { radius: 900, maxWindows: 6 })
      if (windowed.length < 300 || !terms.some((t) => windowed.toLowerCase().includes(t))) continue
      // Leads stray across state lines more often than search does, because a
      // state page will happily link to a neighbour's bulletin.
      if (looksLikeWrongState(windowed, entry.state)) {
        input.onProgress?.(`${entry.state}: discarded a lead that is about a different state`)
        continue
      }

      try {
        const parsed = await askJson<Extraction>({
          tier: "cheap",
          schema: EXTRACT_SCHEMA,
          schemaName: "backfill_extraction",
          label: `backfill ${entry.state}`,
          maxTokens: 2000,
          system:
            `You are filling gaps in what we know about ${stateName}'s Medicaid fee-for-service coverage of ` +
            `${spec.treatmentClass} (${spec.treatments.join(", ")}) for ${spec.name}.\n\n` +
            `We are currently missing: ${gapsFor(record).join(", ").replace(/_/g, " ")}.\n` +
            `What we hold now: status "${record.status}"` +
            (record.effectiveDate ? `, effective ${record.effectiveDate}` : ", no effective date") + `.\n\n` +
            `Report only what THIS excerpt states. Statuses: covered (no gate described), conditional (prior ` +
            `authorization or documented criteria), limited (narrow slice only), not_covered (explicitly excluded), ` +
            `unpublished (this excerpt establishes no policy).\n` +
            `frictionFlags: only gates the excerpt states. Do not infer.\n` +
            `criteriaVerbatim: exact characters, under 400, or null.\n` +
            `If this excerpt describes a DIFFERENT state's policy, set found=false. Never attribute another state's ` +
            `criteria to ${stateName}.\n` +
            `otherVersions: DATED earlier or later versions of this policy the excerpt describes. This excerpt was ` +
            `chosen because it may be a dated bulletin or a superseded list, so capture every dated version it names — ` +
            `that is the point of reading it.\n` +
            `Set found=false rather than guessing.`,
          user: windowed.slice(0, 12_000),
        })
        if (!parsed.found) continue

        const documentDate = parsed.documentDate ?? guessDocumentDate(doc)
        const sourceUrl = doc.final_url ?? doc.url
        const before = gapsFor(record).length

        // Merge rather than replace: a bulletin that dates the policy should not
        // erase criteria language an earlier read already captured.
        const merged = toRecord(
          entry.state,
          spec,
          {
            ...parsed,
            documentDate,
            criteriaSummary: parsed.criteriaSummary ?? record.criteriaSummary,
            criteriaVerbatim: parsed.criteriaVerbatim ?? record.criteriaVerbatim,
            administeringEntity: parsed.administeringEntity ?? record.administeringEntity,
            effectiveDate: parsed.effectiveDate ?? record.effectiveDate,
            // Never let a thin gap-filling read downgrade a state we already
            // answered from its own publication.
            status: parsed.status === "unpublished" && record.status !== "unpublished" ? record.status : parsed.status,
          },
          {
            method: "backfill",
            sourceDoc: doc.title ?? record.sourceDoc,
            sourceUrl: sourceUrl ?? record.sourceUrl,
            evidenceHash: sha256(windowed),
            notes: record.status === "unpublished" ? "Found by following a lead after the first pass came up empty." : null,
            priorHistory: record.history,
          },
        )

        records.set(entry.state, merged)
        input.onRecord?.(merged)
        if (gapsFor(merged).length < before) {
          out.filled++
          input.onProgress?.(`${entry.state}: gap closed — ${merged.status.replace(/_/g, " ")}${merged.effectiveDate ? `, effective ${merged.effectiveDate}` : ""}`)
        }
      } catch (err) {
        input.onProgress?.(`${entry.state}: backfill extraction failed (${String(err).slice(0, 70)})`)
      }
    }
  }

  out.remainingGaps = [...records.values()]
    .map((r) => ({ state: r.state, gaps: gapsFor(r) }))
    .filter((g) => g.gaps.length > 0)
  return out
}

/* ------------------------------------------------------------- inference */

const INFER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["states"],
  properties: {
    states: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["state", "status", "frictionFlags", "criteriaSummary", "basis"],
        properties: {
          state: { type: "string" },
          status: { type: "string", enum: STATUSES as unknown as string[] },
          frictionFlags: { type: "array", items: { type: "string", enum: FLAGS as unknown as string[] } },
          criteriaSummary: { type: ["string", "null"] },
          basis: { type: "string", description: "One sentence on what this is based on and how confident it is" },
        },
      },
    },
  },
} as const

/**
 * The last resort, once the budget has closed.
 *
 * A grey cell tells a provider nothing. A cell that says "probably prior
 * authorization, not verified against a source, review before relying on it" is
 * genuinely more useful — as long as the interface never lets it be mistaken for
 * a sourced record. So these come back with `method: "inferred"`,
 * `confidence: "review_needed"`, no source URL, and a note saying exactly what
 * they are. The UI shows them hatched and the matrix sorts them last.
 *
 * One call covers every remaining state; there is no budget left to spend per
 * state, and there is no evidence to window anyway.
 */
export async function inferRemaining(
  spec: ConditionSpec,
  records: Map<string, CoverageRecord>,
  onProgress?: (note: string) => void,
): Promise<number> {
  const needy = [...records.values()].filter((r) => gapsFor(r).includes("no_policy_found"))
  if (needy.length === 0) return 0
  onProgress?.(`budget closed with ${needy.length} jurisdictions unresolved — filling from model knowledge, flagged for review`)

  try {
    const parsed = await askJson<{
      states: { state: string; status: (typeof STATUSES)[number]; frictionFlags: string[]; criteriaSummary: string | null; basis: string }[]
    }>({
      tier: "smart",
      schema: INFER_SCHEMA,
      schemaName: "inferred_states",
      label: "infer remaining",
      maxTokens: 3000,
      system:
        `Our scanner could not reach a source for some states. Give your best understanding of each one's Medicaid ` +
        `fee-for-service position on ${spec.treatmentClass} for ${spec.name}, from what you know.\n\n` +
        `Policy context: ${spec.policyLever}\n\n` +
        `These answers are labelled "inferred, unverified" in the interface and are never presented as sourced, so ` +
        `state your honest best estimate rather than refusing — but say plainly in "basis" what it rests on and how ` +
        `confident you are. If you genuinely do not know, use status "unpublished" and say so in basis.\n` +
        `frictionFlags: the gates you would expect, empty array if you have no basis for any.`,
      user: `States: ${needy.map((r) => `${r.state} (${r.stateName})`).join(", ")}`,
    })

    let filled = 0
    const now = new Date().toISOString()
    for (const guess of parsed.states) {
      const code = guess.state?.toUpperCase().trim()
      const record = code ? records.get(code) : undefined
      if (!record || !STATE_NAMES[code]) continue
      const flags = (guess.frictionFlags ?? []).filter((f) => (FLAGS as readonly string[]).includes(f)) as CoverageRecord["frictionFlags"]
      const status = guess.status === "covered" && flags.includes("prior_authorization") ? "conditional" : guess.status
      const friction = frictionIndex(status, flags)
      records.set(code, {
        ...record,
        status,
        frictionIndex: friction,
        accessScore: status === "not_covered" || status === "unpublished" ? 0 : Math.max(0, 100 - friction),
        frictionFlags: flags,
        authorization: flags.includes("step_therapy")
          ? "step_therapy"
          : flags.includes("prior_authorization")
            ? "prior_authorization"
            : "none",
        criteriaSummary: guess.criteriaSummary ?? record.criteriaSummary,
        confidence: "review_needed",
        method: "inferred",
        lastCheckedAt: now,
        notes: `Not verified against a source — the scan's call budget closed before this state was resolved. ${guess.basis}`,
      })
      filled++
    }
    return filled
  } catch (err) {
    onProgress?.(`inference pass failed: ${String(err).slice(0, 90)}`)
    return 0
  }
}
