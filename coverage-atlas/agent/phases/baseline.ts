// Phase 2 — one read, fifty answers.
//
// The cheapest fifty-state table in the pipeline: fetch the two or three
// multi-state trackers discovery surfaced, and normalise them in a single
// model call. Every state this settles is a state the per-state fan-out never
// has to pay for. On a typical condition this alone answers 35-45 jurisdictions,
// and the expensive rungs of the ladder are reserved for the rest.
//
// The stability rule in the prompt exists because a reported change is an alert.
// A model that resolves a borderline "covered vs covered-with-limits" call
// differently on Tuesday than it did on Monday manufactures a policy change that
// never happened, and a scanner that cries wolf is worse than no scanner.

import { askJson } from "../lib/llm"
import { fetchContents, normalizeDate } from "../lib/tinyfish"
import { estimateTokens, sha256 } from "../lib/derive"
import { STATE_NAMES, type ConditionSpec, type CoverageRecord, type DiscoveredSource } from "../lib/types"
import type { Budget } from "../lib/budget"

const STATUSES = ["covered", "conditional", "limited", "not_covered", "unpublished"] as const
const FLAGS = [
  "prior_authorization", "step_therapy", "clinical_threshold", "prior_failure_required",
  "supervised_program", "specialist_prescriber", "quantity_limit", "short_renewal",
  "medical_benefit_only", "age_restriction", "diagnosis_restriction",
] as const

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["states", "documentDate"],
  properties: {
    documentDate: { type: ["string", "null"], description: "ISO date the source says it was last verified/updated" },
    states: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["state", "status", "frictionFlags", "criteriaSummary", "criteriaVerbatim", "effectiveDate", "confidence"],
        properties: {
          state: { type: "string", description: "2-letter USPS code" },
          status: { type: "string", enum: STATUSES as unknown as string[] },
          frictionFlags: { type: "array", items: { type: "string", enum: FLAGS as unknown as string[] } },
          criteriaSummary: { type: ["string", "null"], description: "One plain-language sentence. No hedging." },
          criteriaVerbatim: { type: ["string", "null"], description: "Exact wording from the document, or null. Never paraphrase into this field." },
          effectiveDate: { type: ["string", "null"], description: "ISO date, or null" },
          confidence: { type: "string", enum: ["high", "moderate", "review_needed"] },
        },
      },
    },
  },
} as const

export type BaselineRow = {
  state: string
  status: (typeof STATUSES)[number]
  frictionFlags: string[]
  criteriaSummary: string | null
  criteriaVerbatim: string | null
  effectiveDate: string | null
  confidence: "high" | "moderate" | "review_needed"
  sourceDoc: string
  sourceUrl: string
}

export async function buildBaseline(
  spec: ConditionSpec,
  sources: DiscoveredSource[],
  prior: CoverageRecord[],
  budget: Budget,
  onProgress?: (note: string) => void,
): Promise<{ rows: Map<string, BaselineRow>; used: DiscoveredSource[]; fetches: number; naiveTokens: number }> {
  const multiState = sources.filter((s) => s.statesAddressed >= 8).slice(0, 3)
  const rows = new Map<string, BaselineRow>()
  if (multiState.length === 0 || !budget.spendCalls(1)) {
    onProgress?.("no multi-state tracker available — every state goes to the fan-out")
    return { rows, used: [], fetches: 0, naiveTokens: 0 }
  }

  const fetched = await fetchContents(multiState.map((s) => s.url))
  const usable = fetched.filter((f) => (f.text ?? "").trim().length > 800)
  onProgress?.(`fetched ${usable.length}/${multiState.length} trackers`)
  if (usable.length === 0) return { rows, used: [], fetches: 1, naiveTokens: 0 }

  // The counterfactual: a naive scanner sends each whole document to the model
  // once per state. This is what that would have cost in prompt tokens.
  const naiveTokens = usable.reduce((sum, f) => sum + estimateTokens(f.text ?? ""), 0) * 51

  const priorStatuses = Object.fromEntries(prior.map((r) => [r.state, r.status]))
  const used: DiscoveredSource[] = []

  for (const doc of usable) {
    const source = multiState.find((s) => s.url === doc.url || s.url === doc.final_url) ?? multiState[0]
    const text = (doc.text ?? "").slice(0, 70_000)

    let parsed
    try {
      parsed = await askJson<{ documentDate: string | null; states: Omit<BaselineRow, "sourceDoc" | "sourceUrl">[] }>({
        tier: "smart",
        schema: SCHEMA,
        schemaName: "baseline_table",
        label: `baseline ${source.url}`,
        maxTokens: 14_000,
        system:
          `Extract US state Medicaid FEE-FOR-SERVICE coverage of ${spec.treatmentClass} for ${spec.name} from this document.\n` +
          `Policy context: ${spec.policyLever}\n\n` +
          `Status meanings — pick the one the document supports:\n` +
          `  covered      = on the benefit, no notable gate described\n` +
          `  conditional  = covered, but prior authorization or documented criteria stand in front of it\n` +
          `  limited      = covered only for a narrow slice (step therapy, sub-population, hard caps)\n` +
          `  not_covered  = explicitly excluded for this indication\n` +
          `  unpublished  = the document says the state has no published FFS policy\n\n` +
          `frictionFlags: every administrative gate the document actually states for that state. Do not infer gates ` +
          `that are not written down. An empty array is a real and common answer.\n` +
          `criteriaVerbatim: exact characters from the document, or null. This field is an audit trail — paraphrase ` +
          `belongs in criteriaSummary and nowhere else.\n\n` +
          `Only include states this document actually addresses. Omitting a state is correct and expected; ` +
          `inventing one is not.\n\n` +
          `Statuses we already hold from the previous scan: ${JSON.stringify(priorStatuses)}\n` +
          `Stability rule: a state's status only moves if this document plainly and specifically contradicts what we ` +
          `hold. Borderline calls resolve to the status we already have. Every change you report is published to ` +
          `users as a policy alert.`,
        user: text,
      })
    } catch (err) {
      onProgress?.(`tracker ${source.siteName ?? source.url} could not be normalised: ${String(err).slice(0, 120)}`)
      continue
    }

    let added = 0
    for (const row of parsed.states) {
      const code = row.state?.toUpperCase().trim()
      if (!code || !STATE_NAMES[code] || rows.has(code)) continue // first (best-ranked) tracker wins
      rows.set(code, {
        ...row,
        state: code,
        frictionFlags: (row.frictionFlags ?? []).filter((f) => (FLAGS as readonly string[]).includes(f)),
        effectiveDate: normalizeDate(row.effectiveDate) ?? normalizeDate(parsed.documentDate),
        sourceDoc: source.title,
        sourceUrl: source.url,
      })
      added++
    }
    if (added > 0) used.push({ ...source, statesAddressed: added, usedFor: `Baseline for ${added} jurisdictions` })
    onProgress?.(`${source.siteName ?? "tracker"} settled ${added} jurisdictions`)
    if (rows.size >= 48) break // diminishing returns; the fan-out handles the tail
  }

  return { rows, used, fetches: 1, naiveTokens }
}

export function baselineEvidenceHash(row: BaselineRow): string {
  return sha256(`${row.status}|${row.frictionFlags.slice().sort().join(",")}|${row.criteriaVerbatim ?? row.criteriaSummary ?? ""}`)
}
