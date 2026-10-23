// Phase 1 — find the sources. Free: TinyFish search only, no model on the
// happy path for ranking beyond one cheap call.
//
// An arbitrary condition has no hardcoded tracker, so the scanner has to go
// looking. The heuristic that matters: a page that addresses many states at once
// is worth an order of magnitude more than a page about one state, because one
// fetch of it seeds the entire baseline. So we search explicitly for the shape
// of document we want ("by state", "all 50 states", "state-by-state") and rank
// multi-state coverage above authority.

import { search, type SearchResult } from "../lib/tinyfish"
import type { Budget } from "../lib/budget"
import type { LeadPool } from "../lib/leads"
import { askJson } from "../lib/llm"
import type { ConditionSpec, DiscoveredSource } from "../lib/types"

const RANK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks"],
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "kind", "expectedStates", "why"],
        properties: {
          url: { type: "string" },
          kind: { type: "string", enum: ["national_tracker", "state_policy", "news", "federal"] },
          expectedStates: { type: "integer", description: "How many states this page plausibly addresses, 1-51" },
          why: { type: "string" },
        },
      },
    },
  },
} as const

/** Query shapes that surface fifty-state tables rather than one-state pages. */
function queries(spec: ConditionSpec): string[] {
  const t = spec.treatmentClass
  return [
    `Medicaid coverage of ${t} for ${spec.name} by state 2026`,
    `${t} state Medicaid coverage all 50 states comparison table`,
    `state Medicaid ${t} prior authorization criteria state-by-state`,
    `KFF Medicaid ${t} ${spec.name} coverage tracker`,
  ]
}

export async function discoverSources(
  spec: ConditionSpec,
  budget: Budget,
  leads: LeadPool,
  onProgress?: (note: string) => void,
): Promise<{ sources: DiscoveredSource[]; searches: number }> {
  const seen = new Map<string, SearchResult>()
  // Only issue as many queries as the ceiling can afford.
  const qs = queries(spec).slice(0, Math.max(1, Math.min(4, budget.callsLeft)))
  if (!budget.spendCalls(qs.length)) return { sources: [], searches: 0 }

  const batches = await Promise.allSettled(qs.map((q) => search(q)))
  for (const batch of batches) {
    if (batch.status !== "fulfilled") continue
    for (const hit of batch.value.slice(0, 8)) {
      if (!seen.has(hit.url)) seen.set(hit.url, hit)
      // Everything discovery surfaces but does not read becomes a national lead.
      leads.add(hit.url, hit.title, null, "search", null)
    }
  }
  onProgress?.(`${seen.size} candidate sources from ${qs.length} searches`)
  if (seen.size === 0) return { sources: [], searches: qs.length }

  const candidates = [...seen.values()].slice(0, 24)
  const ranked = await askJson<{ picks: { url: string; kind: DiscoveredSource["kind"]; expectedStates: number; why: string }[] }>({
    tier: "cheap",
    schema: RANK_SCHEMA,
    schemaName: "source_ranking",
    label: "rank sources",
    maxTokens: 1600,
    system:
      `Rank web search results by usefulness for building a 51-jurisdiction table of US state Medicaid ` +
      `fee-for-service coverage of ${spec.treatmentClass} for ${spec.name}.\n\n` +
      `Return at most 6 picks, best first. Strongly prefer pages that address MANY states in one document ` +
      `(trackers, comparison tables, KFF/MACPAC/advocacy-org state-by-state reports) — one such page seeds the whole ` +
      `scan. Set expectedStates to how many states the page plausibly covers. Exclude consumer marketing pages, ` +
      `telehealth vendors, law-firm ads, and anything selling the drug. News is useful only for dated policy changes.`,
    user: candidates
      .map((c, i) => `${i + 1}. ${c.title}\n   ${c.url}\n   ${c.site_name ?? ""} ${c.date ?? ""}\n   ${(c.snippet ?? "").slice(0, 220)}`)
      .join("\n\n"),
  })

  const sources: DiscoveredSource[] = ranked.picks
    .map((p) => {
      const hit = seen.get(p.url)
      return {
        url: p.url,
        title: hit?.title ?? p.url,
        siteName: hit?.site_name ?? null,
        kind: p.kind,
        statesAddressed: Math.min(51, Math.max(1, p.expectedStates)),
        usedFor: p.why,
      }
    })
    .sort((a, b) => b.statesAddressed - a.statesAddressed)

  onProgress?.(`${sources.length} sources ranked, best addresses ~${sources[0]?.statesAddressed ?? 0} states`)
  return { sources, searches: qs.length }
}
