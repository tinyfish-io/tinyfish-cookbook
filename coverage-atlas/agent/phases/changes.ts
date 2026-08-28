// Phase 4 — what shifted, and when.
//
// Two independent sources of delta, and the difference between them is the
// honest part of this product:
//
//   observed — our own snapshot differ (lib/derive.ts). Ground truth, because we
//     held the same fifty sources at two points in time and compared them. Only
//     available once a condition has been scanned twice.
//
//   reported — dated public announcements, found here. A state bulletin saying
//     "effective January 1, coverage for weight-management indications ends" is
//     a real event with a real date, and it is the only way a first scan can show
//     history at all.
//
// Every event carries which one it is. Nobody should have to guess whether a
// timeline entry is something the scanner watched happen or something it read.

import { askJson } from "../lib/llm"
import { normalizeDate, search } from "../lib/tinyfish"
import type { Budget } from "../lib/budget"
import { STATE_NAMES, type ChangeDirection, type ChangeEvent, type ConditionSpec } from "../lib/types"

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["state", "direction", "headline", "detail", "announcedOn", "effectiveOn", "sourceTitle", "sourceUrl"],
        properties: {
          state: { type: "string", description: "2-letter USPS code" },
          direction: {
            type: "string",
            enum: ["coverage_added", "coverage_dropped", "loosened", "tightened", "clarified"],
          },
          headline: { type: "string", description: "One plain sentence naming the state and what it did." },
          detail: { type: ["string", "null"] },
          announcedOn: { type: ["string", "null"], description: "ISO date of the announcement" },
          effectiveOn: { type: ["string", "null"], description: "ISO date the change takes effect" },
          sourceTitle: { type: ["string", "null"] },
          sourceUrl: { type: ["string", "null"] },
        },
      },
    },
  },
} as const

const DIRECTION_DELTA: Record<Exclude<ChangeDirection, "stable">, number> = {
  coverage_dropped: 60,
  tightened: 22,
  clarified: 0,
  loosened: -22,
  coverage_added: -60,
}

export async function discoverReportedChanges(
  spec: ConditionSpec,
  windowDays: number,
  budget: Budget,
  onProgress?: (note: string) => void,
): Promise<{ events: ChangeEvent[]; searches: number }> {
  const after = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10)
  const allQueries = [
    `state Medicaid ${spec.treatmentClass} coverage change announcement ${spec.name}`,
    `Medicaid ${spec.treatmentClass} prior authorization requirement added removed state bulletin`,
    `state Medicaid ends coverage ${spec.treatmentClass} ${spec.name} effective date`,
  ]
  // Change discovery runs last, so it takes whatever the ceiling has left.
  const queries = allQueries.slice(0, Math.min(allQueries.length, budget.callsLeft))
  if (queries.length === 0 || !budget.spendCalls(queries.length)) {
    onProgress?.("call ceiling reached before change discovery — relying on snapshot and history deltas")
    return { events: [], searches: 0 }
  }

  const batches = await Promise.allSettled(
    queries.map((q) => search(q, { domainType: "news", afterDate: after })),
  )
  const hits = batches
    .flatMap((b) => (b.status === "fulfilled" ? b.value : []))
    .filter((h, i, all) => all.findIndex((x) => x.url === h.url) === i)
    .slice(0, 30)

  onProgress?.(`${hits.length} dated items since ${after}`)
  if (hits.length === 0) return { events: [], searches: queries.length }

  const parsed = await askJson<{
    events: {
      state: string
      direction: Exclude<ChangeDirection, "stable">
      headline: string
      detail: string | null
      announcedOn: string | null
      effectiveOn: string | null
      sourceTitle: string | null
      sourceUrl: string | null
    }[]
  }>({
    tier: "smart",
    schema: SCHEMA,
    schemaName: "reported_changes",
    label: "reported changes",
    maxTokens: 5000,
    system:
      `From these dated search results, extract concrete changes to US STATE MEDICAID coverage of ` +
      `${spec.treatmentClass} for ${spec.name}.\n\n` +
      `A change event requires a named state and a described policy move. Reject: commercial-insurer news, ` +
      `Medicare-only news, drug approvals, price changes, opinion pieces, and anything that only speculates about ` +
      `what a state might do. A headline saying a state is "considering" something is not an event.\n\n` +
      `direction: coverage_added / coverage_dropped for pathway open/close; loosened / tightened for a gate ` +
      `(prior authorization, step therapy, criteria) being removed or added; clarified when the wording moved but ` +
      `the substance did not.\n` +
      `headline: one sentence, names the state, past tense, no marketing language.\n` +
      `Return an empty array rather than stretching a weak match. Today is ${new Date().toISOString().slice(0, 10)}.`,
    user: hits
      .map((h) => `- ${h.title}\n  ${h.url}\n  ${h.date ?? "undated"} · ${h.site_name ?? ""}\n  ${(h.snippet ?? "").slice(0, 260)}`)
      .join("\n"),
  })

  const detectedAt = new Date().toISOString()
  const events: ChangeEvent[] = []
  for (const e of parsed.events) {
    const code = e.state?.toUpperCase().trim()
    if (!code || !STATE_NAMES[code]) continue
    const announced = normalizeDate(e.announcedOn) ?? normalizeDate(e.effectiveOn) ?? detectedAt.slice(0, 10)
    events.push({
      id: `${code}-${e.direction}-${announced}`,
      state: code,
      stateName: STATE_NAMES[code],
      direction: e.direction,
      headline: e.headline,
      detail: e.detail,
      fromStatus: null,
      toStatus: null,
      frictionDelta: DIRECTION_DELTA[e.direction] ?? 0,
      announcedOn: announced,
      effectiveOn: normalizeDate(e.effectiveOn),
      sourceDoc: e.sourceTitle,
      sourceUrl: e.sourceUrl,
      provenance: "reported",
      detectedAt,
    })
  }

  onProgress?.(`${events.length} reported change events`)
  return { events, searches: queries.length }
}
