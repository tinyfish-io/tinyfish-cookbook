// Phase 3 — the per-state subagent.
//
// This is where a naive design burns its budget, so the contract is deliberately
// narrow: a subagent receives one state, the condition spec, and whatever the
// baseline already believes about that state. It never sees the other fifty
// states, the tracker document, the orchestrator's reasoning, or the results of
// its siblings. Its context is a couple of thousand tokens and it returns one
// record. Nothing about state 34's job requires knowing anything about state 12,
// and a shared conversation that accumulated all fifty would cost quadratically
// for no accuracy gain.
//
// It walks the escalation ladder and stops at the first rung that answers:
//
//   0. carry-forward — the evidence hash is unchanged since the last scan.
//      Zero model tokens, zero metered calls. On a re-scan most states land here,
//      which is exactly what makes a scheduled scanner affordable.
//   1. search  — free. Finds the state's own policy document.
//   2. fetch   — free. Pulls it as markdown, then windows it down to the passages
//      that mention the drug.
//   3. agent   — metered, stealth browser. Only when fetch came back empty or a
//      403, which is common for state Medicaid portals. Capped by a run budget
//      the orchestrator holds.

import { askJson } from "../lib/llm"
import { fetchContents, guessDocumentDate, normalizeDate, runAgent, search, unwrapAgentResult } from "../lib/tinyfish"
import { estimateTokens, frictionIndex, looksLikeWrongState, sha256, sortHistory, windowText } from "../lib/derive"
import type { Budget } from "../lib/budget"
import type { LeadPool } from "../lib/leads"
import {
  STATE_FIPS,
  STATE_NAMES,
  type ConditionSpec,
  type Confidence,
  type CoverageRecord,
  type CoverageStatus,
  type FrictionFlag,
  type PolicyVersion,
} from "../lib/types"
import type { BaselineRow } from "./baseline"

const STATUSES = ["covered", "conditional", "limited", "not_covered", "unpublished"] as const
const FLAGS = [
  "prior_authorization", "step_therapy", "clinical_threshold", "prior_failure_required",
  "supervised_program", "specialist_prescriber", "quantity_limit", "short_renewal",
  "medical_benefit_only", "age_restriction", "diagnosis_restriction",
] as const

const VERSION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "frictionFlags", "effectiveDate", "note"],
  properties: {
    status: { type: "string", enum: STATUSES as unknown as string[] },
    frictionFlags: { type: "array", items: { type: "string", enum: FLAGS as unknown as string[] } },
    effectiveDate: { type: ["string", "null"], description: "ISO date this version took effect or stopped applying" },
    note: { type: ["string", "null"], description: "What the excerpt says about this earlier or later version" },
  },
} as const

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "found", "status", "frictionFlags", "criteriaSummary", "criteriaVerbatim",
    "administeringEntity", "effectiveDate", "documentDate", "otherVersions", "confidence",
  ],
  properties: {
    found: { type: "boolean", description: "false if the excerpt says nothing about this state and this treatment" },
    status: { type: "string", enum: STATUSES as unknown as string[] },
    frictionFlags: { type: "array", items: { type: "string", enum: FLAGS as unknown as string[] } },
    criteriaSummary: { type: ["string", "null"] },
    criteriaVerbatim: { type: ["string", "null"], description: "Exact characters from the excerpt, or null." },
    administeringEntity: { type: ["string", "null"], description: "State agency or contracted PBM named in the excerpt" },
    effectiveDate: { type: ["string", "null"], description: "ISO date the CURRENT policy took effect" },
    documentDate: { type: ["string", "null"], description: "ISO date this document was published or last revised" },
    otherVersions: {
      type: "array",
      description:
        "Dated versions of this state's policy OTHER than the current one that the excerpt describes — what the rule " +
        "was before a change, or what it becomes on a future date. Empty array when the excerpt describes only one.",
      items: VERSION_SCHEMA,
    },
    confidence: { type: "string", enum: ["high", "moderate", "review_needed"] },
  },
} as const

export type ExtractedVersion = {
  status: CoverageStatus
  frictionFlags: FrictionFlag[]
  effectiveDate: string | null
  note: string | null
}

export type Extraction = {
  found: boolean
  status: CoverageStatus
  frictionFlags: FrictionFlag[]
  criteriaSummary: string | null
  criteriaVerbatim: string | null
  administeringEntity: string | null
  effectiveDate: string | null
  documentDate?: string | null
  otherVersions?: ExtractedVersion[]
  confidence: Confidence
}

export type SubagentInput = {
  state: string
  spec: ConditionSpec
  baseline: BaselineRow | undefined
  prior: CoverageRecord | undefined
  /** The scan-wide ceiling. Every call this subagent makes is reserved through it. */
  budget: Budget
  /** Shared across the scan: leads found here feed the backfill pass. */
  leads?: LeadPool
  onProgress?: (note: string) => void
}

export type SubagentOutcome = {
  record: CoverageRecord
  searches: number
  fetches: number
  agentRuns: number
  shortCircuited: boolean
  /** Prompt tokens a whole-document-per-state scanner would have spent here. */
  naiveTokens: number
}

/** Prefer the state's own domain, then its contracted PBM, then anything else. */
function rankPolicyUrls(results: { url: string; title: string }[], stateName: string): string[] {
  const score = (u: string, t: string) => {
    const url = u.toLowerCase()
    const title = t.toLowerCase()
    let s = 0
    if (/\.gov(\/|$)/.test(url)) s += 40
    if (url.includes("medicaid")) s += 18
    if (/(pdl|preferred[-_]?drug|formulary|prior[-_]?auth|criteria|fee[-_]?schedule)/.test(url + title)) s += 22
    if (url.endsWith(".pdf")) s += 8
    if (title.includes(stateName.toLowerCase())) s += 10
    if (/(goodrx|singlecare|drugs\.com|healthline|webmd|reddit|ro\.co|hims|noom)/.test(url)) s -= 60
    return s
  }
  return results
    .map((r) => ({ ...r, s: score(r.url, r.title) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((r) => r.url)
}

/** Turn one extraction into a dated version of the state's policy. */
function toVersion(
  e: { status: CoverageStatus; frictionFlags: FrictionFlag[]; effectiveDate: string | null; criteriaSummary?: string | null; criteriaVerbatim?: string | null },
  meta: { documentDate: string | null; sourceDoc: string | null; sourceUrl: string | null; isCurrent: boolean },
): PolicyVersion {
  const flags = [...new Set(e.frictionFlags ?? [])]
  const status = e.status === "covered" && flags.includes("prior_authorization") ? "conditional" : e.status
  return {
    status,
    authorization: flags.includes("step_therapy")
      ? "step_therapy"
      : flags.includes("prior_authorization")
        ? "prior_authorization"
        : "none",
    frictionFlags: flags,
    frictionIndex: frictionIndex(status, flags),
    criteriaSummary: e.criteriaSummary ?? null,
    criteriaVerbatim: e.criteriaVerbatim ?? null,
    effectiveDate: normalizeDate(e.effectiveDate),
    documentDate: normalizeDate(meta.documentDate),
    sourceDoc: meta.sourceDoc,
    sourceUrl: meta.sourceUrl,
    isCurrent: meta.isCurrent,
    discoveredAt: new Date().toISOString(),
  }
}

export function toRecord(
  state: string,
  spec: ConditionSpec,
  e: Extraction,
  meta: {
    method: CoverageRecord["method"]
    sourceDoc: string | null
    sourceUrl: string | null
    evidenceHash: string | null
    notes?: string | null
    /** Versions already known for this state, e.g. from an earlier pass. */
    priorHistory?: PolicyVersion[]
  },
): CoverageRecord {
  const flags = [...new Set(e.frictionFlags ?? [])]
  // A prior-authorization flag and a "covered with no gate" status contradict each
  // other; the flags are the more specific evidence, so they win.
  const status: CoverageStatus =
    e.status === "covered" && flags.includes("prior_authorization") ? "conditional" : e.status
  const authorization = flags.includes("step_therapy")
    ? "step_therapy"
    : flags.includes("prior_authorization")
      ? "prior_authorization"
      : "none"
  const friction = frictionIndex(status, flags)
  const documentDate = normalizeDate(e.documentDate)
  const effectiveDate = normalizeDate(e.effectiveDate)

  const current = toVersion(
    { status, frictionFlags: flags, effectiveDate, criteriaSummary: e.criteriaSummary, criteriaVerbatim: e.criteriaVerbatim },
    { documentDate, sourceDoc: meta.sourceDoc, sourceUrl: meta.sourceUrl, isCurrent: true },
  )
  // Dated versions the source described other than the one in force. These are
  // what let a first scan show a timeline instead of a single flat snapshot.
  const others = (e.otherVersions ?? [])
    .filter((v) => v.status && (v.effectiveDate || v.note))
    .map((v) =>
      toVersion(
        { status: v.status, frictionFlags: v.frictionFlags ?? [], effectiveDate: v.effectiveDate, criteriaSummary: v.note },
        { documentDate, sourceDoc: meta.sourceDoc, sourceUrl: meta.sourceUrl, isCurrent: false },
      ),
    )

  return {
    state,
    stateName: STATE_NAMES[state],
    fips: STATE_FIPS[state],
    program: "medicaid_ffs",
    status,
    authorization,
    frictionFlags: flags,
    frictionIndex: friction,
    accessScore: status === "not_covered" || status === "unpublished" ? 0 : Math.max(0, 100 - friction),
    criteriaSummary: e.criteriaSummary,
    criteriaVerbatim: e.criteriaVerbatim,
    administeringEntity: e.administeringEntity,
    sourceDoc: meta.sourceDoc,
    sourceUrl: meta.sourceUrl,
    effectiveDate,
    confidence: e.confidence,
    method: meta.method,
    lastCheckedAt: new Date().toISOString(),
    documentDate,
    history: sortHistory([...(meta.priorHistory ?? []), ...others, current]),
    evidenceHash: meta.evidenceHash,
    notes: meta.notes ?? null,
  }
}

export async function runSubagent(input: SubagentInput): Promise<SubagentOutcome> {
  const { state, spec, baseline, prior, budget, leads } = input
  const stateName = STATE_NAMES[state]
  const terms = [...spec.searchTerms, ...spec.treatments.map((t) => t.toLowerCase())]
  let searches = 0
  let fetches = 0
  let agentRuns = 0
  let naiveTokens = 0

  // Rung 1 — find the state's own policy document.
  let hits: { url: string; title: string }[] = []
  if (budget.spendCalls(1)) {
    searches = 1
    try {
      const found = await search(
        `${stateName} Medicaid ${spec.treatmentClass} prior authorization criteria preferred drug list ${spec.name}`,
      )
      hits = found.map((r) => ({ url: r.url, title: r.title }))
      // Everything we do not fetch now is a lead for the backfill pass.
      for (const hit of hits) leads?.add(hit.url, hit.title, state, "search", stateName)
    } catch {
      /* the ladder degrades: no search just means we lean on the baseline */
    }
  }
  // Three candidates in one batched fetch: state portals are full of thin landing
  // pages that never name the drug, and a second and third try costs nothing.
  const urls = rankPolicyUrls(hits, stateName).slice(0, 3)

  // Rung 2 — pull the document and window it to the passages that mention the drug.
  let excerpt = ""
  let sourceUrl: string | null = null
  let sourceDoc: string | null = null
  let documentDate: string | null = null
  if (urls.length > 0 && budget.spendCalls(1)) {
    fetches = 1
    leads?.markSpent(urls)
    try {
      const docs = await fetchContents(urls, 60_000)
      for (const doc of docs) {
        const text = doc.text ?? ""
        // Outbound links are harvested even from the wrong page — the landing
        // page that answered nothing usually links to the document that does.
        leads?.addPageLinks(doc.links, state, stateName)
        if (text.length < 400) continue
        naiveTokens += estimateTokens(text)
        const windowed = windowText(text, terms, { radius: 900, maxWindows: 6 })
        // A page that never mentions the drug is the wrong page, not a "not covered" answer.
        if (windowed.length < 300 || !terms.some((t) => windowed.toLowerCase().includes(t))) continue
        // ...and a page about a different state is worse than no page at all.
        if (looksLikeWrongState(windowed, state)) {
          input.onProgress?.(`${state}: discarded a source that is about a different state`)
          continue
        }
        excerpt = windowed
        sourceUrl = doc.final_url ?? doc.url
        sourceDoc = doc.title ?? null
        documentDate = guessDocumentDate(doc)
        break
      }
    } catch {
      /* fall through to the metered rung */
    }
  }

  // Rung 0 — nothing has moved since last time. Free.
  const candidateHash = excerpt ? sha256(excerpt) : null
  if (candidateHash && prior?.evidenceHash === candidateHash) {
    input.onProgress?.(`${state}: source unchanged since last scan, carried forward`)
    return {
      record: { ...prior, lastCheckedAt: new Date().toISOString(), method: "carried_forward" },
      searches,
      fetches,
      agentRuns: 0,
      shortCircuited: true,
      naiveTokens,
    }
  }

  // Rung 3 — the state portal blocked us. Spend a metered browser run, if the
  // scan's budget allows and the baseline has not already answered.
  if (!excerpt && (!baseline || baseline.confidence !== "high")) {
    const target = urls[0] ?? hits[0]?.url
    if (target && budget.spendAgentRun()) {
      agentRuns = 1
      try {
        input.onProgress?.(`${state}: plain fetch blocked, escalating to a stealth browser`)
        const raw = await runAgent({
          url: target,
          stealth: true,
          timeoutMs: 200_000,
          goal:
            `Find what this page says about ${stateName} Medicaid fee-for-service coverage of ${spec.treatmentClass} ` +
            `(${spec.treatments.join(", ")}) for ${spec.name}. Return STRICT JSON only:\n` +
            `{"found":boolean,"status":"covered|conditional|limited|not_covered|unpublished",` +
            `"frictionFlags":[${FLAGS.map((f) => `"${f}"`).join("|")}],"criteriaSummary":"one plain sentence",` +
            `"criteriaVerbatim":"exact wording from the page or null","administeringEntity":"state agency or PBM or null",` +
            `"effectiveDate":"YYYY-MM-DD or null","documentDate":"YYYY-MM-DD the page was published or revised, or null",` +
            `"otherVersions":[{"status":"...","frictionFlags":[],"effectiveDate":"YYYY-MM-DD","note":"what the page says this earlier or later version was"}],` +
            `"confidence":"high|moderate|review_needed"}\n` +
            `otherVersions captures any DATED earlier or later version of this policy the page describes — what the ` +
            `rule was before a change, or what it becomes on a future date. Use an empty array if the page describes ` +
            `only one version. Set found=false if the page does not address this treatment. Never guess a status.`,
          onProgress: (p) => input.onProgress?.(`${state}: ${p}`),
        })
        const parsed = unwrapAgentResult(raw) as Extraction | null
        if (parsed?.found && parsed.status) {
          return {
            record: toRecord(state, spec, parsed, {
              method: "agent",
              sourceDoc: sourceDoc ?? `${stateName} Medicaid policy page`,
              sourceUrl: target,
              evidenceHash: sha256(JSON.stringify(parsed)),
              notes: "Read by a stealth browser agent — the state portal refuses plain fetchers.",
              priorHistory: prior?.history,
            }),
            searches, fetches, agentRuns, shortCircuited: false, naiveTokens,
          }
        }
      } catch (err) {
        input.onProgress?.(`${state}: browser run failed (${String(err).slice(0, 80)})`)
      }
    }
  }

  // Extract from whatever evidence we have. The excerpt is the state's own
  // document; the baseline row is what a national tracker said. If we have both,
  // the state's own words are authoritative and the tracker is context.
  if (excerpt) {
    try {
      const parsed = await askJson<Extraction>({
        tier: "cheap",
        schema: EXTRACT_SCHEMA,
        schemaName: "state_extraction",
        label: `extract ${state}`,
        maxTokens: 2000,
        system:
          `You are reading an excerpt of ${stateName}'s own Medicaid policy documents. Report only what this excerpt ` +
          `states about coverage of ${spec.treatmentClass} (${spec.treatments.join(", ")}) for ${spec.name}.\n\n` +
          `covered = on the benefit with no gate described. conditional = prior authorization or documented criteria ` +
          `stand in front. limited = only a narrow slice qualifies. not_covered = explicitly excluded. ` +
          `unpublished = the excerpt does not establish a policy.\n\n` +
          `frictionFlags: only gates the excerpt actually states. Do not infer. An empty array is a real answer.\n` +
          `criteriaVerbatim: exact characters from the excerpt, under 400 characters, or null.\n` +
          `If the excerpt turns out to describe a DIFFERENT state's policy, set found=false. Never attribute another ` +
          `state's criteria to ${stateName}.\n` +
          `effectiveDate: when the CURRENT policy took effect. documentDate: when this document was published or revised.\n` +
          `otherVersions: any DATED earlier or later version of this state's policy the excerpt describes — a bulletin ` +
          `announcing a change usually states what the rule was before it, and a superseded list carries the date it ` +
          `stopped applying. This is how coverage change gets recorded, so capture it whenever the excerpt supports it. ` +
          `Return an empty array when the excerpt describes only the current version.\n` +
          (baseline
            ? `A national tracker reports "${baseline.status}" for ${stateName}. Treat that as context, not evidence: ` +
              `this excerpt is the state's own document and outranks it. Contradict the tracker only if the excerpt is clear.\n`
            : "") +
          `Set found=false rather than guessing.`,
        user: excerpt.slice(0, 12_000),
      })
      if (parsed.found) {
        return {
          record: toRecord(state, spec, { ...parsed, documentDate: parsed.documentDate ?? documentDate }, {
            method: "fetch",
            sourceDoc,
            sourceUrl,
            evidenceHash: candidateHash,
            priorHistory: prior?.history,
          }),
          searches, fetches, agentRuns, shortCircuited: false, naiveTokens,
        }
      }
    } catch (err) {
      input.onProgress?.(`${state}: extraction failed (${String(err).slice(0, 80)})`)
    }
  }

  // Fall back to the baseline. Confidence drops a notch because nothing in the
  // state's own publications corroborated it.
  if (baseline) {
    return {
      record: toRecord(
        state,
        spec,
        {
          found: true,
          status: baseline.status,
          frictionFlags: baseline.frictionFlags as FrictionFlag[],
          criteriaSummary: baseline.criteriaSummary,
          criteriaVerbatim: baseline.criteriaVerbatim,
          administeringEntity: null,
          effectiveDate: baseline.effectiveDate,
          documentDate: baseline.effectiveDate,
          otherVersions: [],
          confidence: baseline.confidence === "high" ? "moderate" : "review_needed",
        },
        {
          method: "baseline",
          sourceDoc: baseline.sourceDoc,
          sourceUrl: baseline.sourceUrl,
          evidenceHash: null,
          notes: "From a multi-state tracker; the state's own publication did not corroborate it in this scan.",
          priorHistory: prior?.history,
        },
      ),
      searches, fetches, agentRuns, shortCircuited: false, naiveTokens,
    }
  }

  // Nothing anywhere yet. "No published fee-for-service policy" is a real and
  // reportable finding — several states genuinely leave this to their MCOs — but
  // it is also the gap the backfill pass exists to attack before we settle on it.
  return {
    record: toRecord(
      state,
      spec,
      {
        found: true,
        status: "unpublished",
        frictionFlags: [],
        criteriaSummary: null,
        criteriaVerbatim: null,
        administeringEntity: null,
        effectiveDate: null,
        documentDate: null,
        otherVersions: [],
        confidence: "review_needed",
      },
      { method: "search", sourceDoc: null, sourceUrl: urls[0] ?? null, evidenceHash: null, priorHistory: prior?.history },
    ),
    searches, fetches, agentRuns, shortCircuited: false, naiveTokens,
  }
}
