// Everything computed rather than extracted: evidence windowing, the Access
// Friction Index, peer-group outlier detection, and the snapshot differ.
//
// The split matters. Anything a model states about a state is extraction and
// must carry a citation. Anything Coverage Atlas asserts *across* states —
// friction scores, outliers, deltas — is arithmetic over those citations, and is
// reproducible from the stored snapshots without calling a model at all.

import { createHash } from "node:crypto"
import {
  FRICTION_WEIGHTS,
  PEER_OF,
  STATE_NAMES,
  type ChangeEvent,
  type CoverageRecord,
  type CoverageStatus,
  type FrictionFlag,
  type PolicyVersion,
  type RecordGap,
} from "./types"

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32)
}

/**
 * Cut a long document down to the passages that actually mention the thing we
 * are asking about.
 *
 * This is the single largest token saving in the pipeline. A state preferred-drug
 * list is 60-120k characters of tables for hundreds of drugs; the eight passages
 * that mention semaglutide are perhaps 5k. Sending the whole document to a model
 * 51 times is how a naive scanner burns a million prompt tokens per condition.
 */
export function windowText(text: string, terms: string[], opts: { radius?: number; maxWindows?: number } = {}): string {
  const radius = opts.radius ?? 1100
  const maxWindows = opts.maxWindows ?? 8
  if (!text) return ""
  if (text.length <= radius * 2) return text

  const haystack = text.toLowerCase()
  const hits: number[] = []
  for (const term of terms) {
    const needle = term.toLowerCase().trim()
    if (needle.length < 3) continue
    let from = 0
    while (hits.length < maxWindows * 4) {
      const at = haystack.indexOf(needle, from)
      if (at === -1) break
      hits.push(at)
      from = at + needle.length
    }
  }
  if (hits.length === 0) return text.slice(0, radius * 2)

  // Merge overlapping windows so a dense cluster of hits reads as one passage.
  const spans: [number, number][] = []
  for (const at of hits.sort((a, b) => a - b)) {
    const start = Math.max(0, at - radius)
    const end = Math.min(text.length, at + radius)
    const last = spans[spans.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else spans.push([start, end])
  }

  return spans
    .slice(0, maxWindows)
    .map(([s, e]) => text.slice(s, e))
    .join("\n\n[...]\n\n")
}

/** Rough but stable token estimate — used only for the savings ledger, never for billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * The Access Friction Index: 0 (walk into a pharmacy) to 100 (no pathway).
 *
 * Weights are additive and then squashed, so the first two gates move the number
 * a lot and the seventh moves it a little — which matches how access actually
 * fails. A patient stopped by prior authorization is stopped; a quantity limit
 * on top of that changes their life much less than the first barrier did.
 */
export function frictionIndex(status: CoverageStatus, flags: FrictionFlag[]): number {
  if (status === "not_covered") return 100
  if (status === "unpublished") return 92 // no published pathway is not the same as a refusal, but it is close
  const raw = [...new Set(flags)].reduce((sum, flag) => sum + (FRICTION_WEIGHTS[flag] ?? 0), 0)
  const squashed = 100 * (1 - Math.exp(-raw / 55))
  const floor = status === "limited" ? 30 : status === "conditional" ? 18 : 0
  return Math.round(Math.max(squashed, floor))
}

export function accessScore(record: Pick<CoverageRecord, "status" | "frictionIndex">): number {
  if (record.status === "not_covered" || record.status === "unpublished") return 0
  return Math.max(0, 100 - record.frictionIndex)
}

export type Outlier = {
  state: string
  stateName: string
  kind: "easiest" | "hardest" | "peer_outlier" | "recently_changed"
  headline: string
  detail: string
}

/**
 * What stands out — computed, not curated. National extremes first, then the
 * state that diverges most from its own census division, which is the finding
 * providers actually react to: neighbouring states with similar budgets and
 * similar populations landing thirty friction points apart.
 */
export function findOutliers(records: CoverageRecord[], changes: ChangeEvent[]): Outlier[] {
  const usable = records.filter((r) => r.status !== "unpublished")
  if (usable.length < 4) return []

  const out: Outlier[] = []
  const byAccess = [...usable].sort((a, b) => b.accessScore - a.accessScore)
  const easiest = byAccess[0]
  const hardest = [...usable].filter((r) => r.status !== "not_covered").sort((a, b) => b.frictionIndex - a.frictionIndex)[0]

  const covering = records.filter((r) => r.status === "covered" || r.status === "conditional").length
  out.push({
    state: easiest.state,
    stateName: easiest.stateName,
    kind: "easiest",
    headline: "Lowest friction in the country",
    detail:
      `${easiest.stateName} scores ${easiest.accessScore}/100 for access` +
      (easiest.frictionFlags.length === 0
        ? " with no documented administrative gate at all."
        : ` behind only ${easiest.frictionFlags.length} documented gate${easiest.frictionFlags.length === 1 ? "" : "s"}.`) +
      ` ${covering} of ${records.length} jurisdictions have any pathway.`,
  })

  if (hardest && hardest.state !== easiest.state) {
    out.push({
      state: hardest.state,
      stateName: hardest.stateName,
      kind: "hardest",
      headline: "Covered on paper, hardest in practice",
      detail: `${hardest.stateName} reports coverage but stacks ${hardest.frictionFlags.length} gates, landing at ${hardest.frictionIndex}/100 friction — ${hardest.frictionIndex - easiest.frictionIndex} points above ${easiest.stateName}.`,
    })
  }

  // Divergence from the state's own census-division peers.
  const byPeer = new Map<string, CoverageRecord[]>()
  for (const r of usable) {
    const region = PEER_OF[r.state]
    if (!region) continue
    byPeer.set(region, [...(byPeer.get(region) ?? []), r])
  }
  let widest: { record: CoverageRecord; gap: number; region: string; peerMean: number } | null = null
  for (const [region, group] of byPeer) {
    if (group.length < 3) continue
    const mean = group.reduce((s, r) => s + r.frictionIndex, 0) / group.length
    for (const r of group) {
      const gap = Math.abs(r.frictionIndex - mean)
      if (!widest || gap > widest.gap) widest = { record: r, gap, region, peerMean: mean }
    }
  }
  if (widest && widest.gap >= 12) {
    const harder = widest.record.frictionIndex > widest.peerMean
    out.push({
      state: widest.record.state,
      stateName: widest.record.stateName,
      kind: "peer_outlier",
      headline: `Breaks from the ${widest.region}`,
      detail: `${widest.record.stateName} sits ${Math.round(widest.gap)} friction points ${harder ? "above" : "below"} its ${widest.region} peers (regional mean ${Math.round(widest.peerMean)}). Same region, same neighbours, different answer for the patient.`,
    })
  }

  const recent = changes.filter((c) => c.direction !== "stable" && c.direction !== "clarified")[0]
  if (recent) {
    out.push({
      state: recent.state,
      stateName: recent.stateName,
      kind: "recently_changed",
      headline: recent.direction === "coverage_dropped" || recent.direction === "tightened" ? "Access tightened" : "Access widened",
      detail: recent.headline,
    })
  }

  return out.slice(0, 4)
}

/** How directly a record's evidence came from the jurisdiction's own publication. */
const EVIDENCE_TIER: Record<CoverageRecord["method"], number> = {
  inferred: 0,
  search: 1,
  carried_forward: 2,
  baseline: 2,
  fetch: 3,
  backfill: 3,
  agent: 3,
}

/**
 * Did we learn something, rather than watch something change?
 *
 * This is the difference between "Illinois now requires prior authorization" and
 * "we finally found Illinois's policy". Both look identical to a naive differ —
 * the stored status moved — but only one is a policy event, and publishing the
 * other as an alert is how a scanner destroys its own credibility. A backfill
 * pass that closes gaps necessarily rewrites records, so without this guard
 * every improvement to our own coverage is announced as a change in the world.
 */
function isKnowledgeGain(was: CoverageRecord, now: CoverageRecord): boolean {
  if (was.status === "unpublished" && now.status !== "unpublished") return true
  if (!was.sourceUrl && now.sourceUrl) return true
  return EVIDENCE_TIER[now.method] > EVIDENCE_TIER[was.method]
}

/**
 * A policy change has a date.
 *
 * Two readings of the same undated source that disagree are a disagreement
 * between readings, not a change over time. Requiring a date to have advanced
 * keeps extraction volatility — the same PDF parsed twice, a different page of
 * the same formulary — out of a feed users are meant to treat as alerts.
 */
function dateAdvanced(was: CoverageRecord, now: CoverageRecord): boolean {
  const before = was.effectiveDate ?? was.documentDate ?? ""
  const after = now.effectiveDate ?? now.documentDate ?? ""
  return after > before
}

const STATUS_RANK: Record<CoverageStatus, number> = {
  covered: 4,
  conditional: 3,
  limited: 2,
  not_covered: 1,
  unpublished: 0,
}

/**
 * Diff two snapshots into change events.
 *
 * Medicaid publishes no change feed anywhere in the country — the delta has to be
 * computed by holding two observations of fifty independent sources side by side.
 * That is the whole reason this needs a live scanner rather than a dataset.
 *
 * Both a status move and a friction move count, because "still covered, now with
 * step therapy" is a real access event that a status-only differ reports as
 * nothing happening. A friction move under 6 points is treated as extraction
 * noise, not policy.
 */
export function diffSnapshots(
  before: CoverageRecord[],
  after: CoverageRecord[],
  detectedAt: string,
): ChangeEvent[] {
  const prior = new Map(before.map((r) => [r.state, r]))
  const events: ChangeEvent[] = []

  for (const now of after) {
    const was = prior.get(now.state)
    if (!was) continue
    if (was.status === now.status && Math.abs(now.frictionIndex - was.frictionIndex) < 6) continue
    // Our own coverage improving is not the world changing.
    if (isKnowledgeGain(was, now)) continue
    if (!dateAdvanced(was, now)) continue

    const frictionDelta = now.frictionIndex - was.frictionIndex
    const statusMoved = was.status !== now.status
    const rankDelta = STATUS_RANK[now.status] - STATUS_RANK[was.status]

    let direction: ChangeEvent["direction"]
    let headline: string
    if (statusMoved && STATUS_RANK[was.status] > 1 && STATUS_RANK[now.status] <= 1) {
      direction = "coverage_dropped"
      headline = `${now.stateName} ended its coverage pathway`
    } else if (statusMoved && STATUS_RANK[was.status] <= 1 && STATUS_RANK[now.status] > 1) {
      direction = "coverage_added"
      headline = `${now.stateName} opened a coverage pathway`
    } else if (frictionDelta < 0 || rankDelta > 0) {
      direction = "loosened"
      headline = `${now.stateName} eased access by ${Math.abs(frictionDelta)} friction points`
    } else {
      direction = "tightened"
      headline = `${now.stateName} tightened access by ${frictionDelta} friction points`
    }

    const gained = now.frictionFlags.filter((f) => !was.frictionFlags.includes(f))
    const lost = was.frictionFlags.filter((f) => !now.frictionFlags.includes(f))
    const detailParts = [
      statusMoved ? `Status moved from ${was.status.replace("_", " ")} to ${now.status.replace("_", " ")}.` : null,
      gained.length ? `Added: ${gained.join(", ").replace(/_/g, " ")}.` : null,
      lost.length ? `Removed: ${lost.join(", ").replace(/_/g, " ")}.` : null,
    ].filter(Boolean)

    // Keyed on the policy's own date, not the scan's, so the same event found by
    // two different routes collapses into one entry rather than appearing twice.
    const when = now.effectiveDate ?? now.documentDate ?? detectedAt.slice(0, 10)
    events.push({
      id: `${now.state}-${direction}-${when}`,
      state: now.state,
      stateName: now.stateName,
      direction,
      headline,
      detail: detailParts.join(" ") || null,
      fromStatus: was.status,
      toStatus: now.status,
      frictionDelta,
      // Date the event by the policy, not by when we happened to look. Falling
      // back to "today" would tell a user a rule changed this morning when the
      // document we read it from is eight months old.
      announcedOn: when,
      effectiveOn: now.effectiveDate,
      sourceDoc: now.sourceDoc,
      sourceUrl: now.sourceUrl,
      provenance: "observed",
      detectedAt,
    })
  }

  return events.sort((a, b) => Math.abs(b.frictionDelta) - Math.abs(a.frictionDelta))
}


/* ------------------------------------------------------------------- gaps */

/**
 * What a record is still missing.
 *
 * This is the scan's to-do list and its stop condition in one function. The
 * orchestrator backfills against it and finishes early when it comes back empty
 * for every jurisdiction — at which point there is genuinely nothing left worth
 * spending a call on.
 *
 * `no_history` is deliberately not counted as a blocking gap for a state we have
 * otherwise answered well: plenty of states simply have not changed their policy,
 * and an absence of history is a legitimate finding rather than a hole.
 */
export function gapsFor(record: CoverageRecord): RecordGap[] {
  const gaps: RecordGap[] = []
  if (record.status === "unpublished") gaps.push("no_policy_found")
  if (!record.sourceUrl) gaps.push("no_source")
  if (!record.effectiveDate && !record.documentDate) gaps.push("no_timestamp")
  if (!record.criteriaVerbatim && !record.criteriaSummary) gaps.push("no_criteria")
  return gaps
}

/** Blocking gaps only — what the stop condition actually waits on. */
export function isRecordComplete(record: CoverageRecord): boolean {
  return gapsFor(record).length === 0
}

/** Worst-first, so a limited budget is spent where it changes the map most. */
export function prioritiseGaps(records: CoverageRecord[]): CoverageRecord[] {
  const weight = (r: CoverageRecord) => {
    const gaps = gapsFor(r)
    return (
      (gaps.includes("no_policy_found") ? 100 : 0) +
      (gaps.includes("no_source") ? 40 : 0) +
      (gaps.includes("no_timestamp") ? 25 : 0) +
      (gaps.includes("no_criteria") ? 15 : 0)
    )
  }
  return records.filter((r) => gapsFor(r).length > 0).sort((a, b) => weight(b) - weight(a))
}

/* ---------------------------------------------------------------- history */

/**
 * Drop versions that a document almost certainly failed to transcribe rather
 * than described.
 *
 * A single source claiming a state removed a set of gates and then re-added the
 * identical set is describing a transcription gap, not a policy that changed and
 * changed back. Left in, one such version produces two contradictory events —
 * "eased by 26 points" and "tightened by 26 points" — which is worse than
 * reporting nothing.
 */
function denoiseHistory(versions: PolicyVersion[]): PolicyVersion[] {
  if (versions.length < 3) return versions
  const fingerprint = (v: PolicyVersion) => `${v.status}|${v.frictionFlags.slice().sort().join(",")}`
  return versions.filter((v, i) => {
    const before = versions[i - 1]
    const after = versions[i + 1]
    if (!before || !after) return true
    return !(fingerprint(before) === fingerprint(after) && fingerprint(v) !== fingerprint(before))
  })
}

/** Chronological, current version last, one entry per (effective date, status). */
export function sortHistory(versions: PolicyVersion[]): PolicyVersion[] {
  const key = (v: PolicyVersion) => v.effectiveDate ?? v.documentDate ?? ""
  const seen = new Set<string>()
  return versions
    .filter((v) => {
      const id = `${key(v)}|${v.status}|${v.frictionFlags.slice().sort().join(",")}`
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .sort((a, b) => key(a).localeCompare(key(b)))
}

/**
 * Change events derived from dated versions found inside a single scan.
 *
 * This is what lets a first scan say anything about change at all. Medicaid
 * publishes no change feed, but its documents are full of dated self-reference —
 * a bulletin announcing a new rule states the old one, a superseded drug list
 * carries the date it stopped applying. Walking a state's versions in order and
 * diffing adjacent pairs turns that into a timeline.
 *
 * Marked `historical` rather than `observed`: we read two dated versions of the
 * state's own policy and compared them, which is a stronger claim than a news
 * headline and a weaker one than having watched it change ourselves.
 */
export function changesFromHistory(records: CoverageRecord[], detectedAt: string): ChangeEvent[] {
  const events: ChangeEvent[] = []

  for (const record of records) {
    // Only dated versions can be diffed: two observations you cannot order in
    // time have no delta between them, and pairing an undated version with a
    // dated one produces contradictory events on the same day.
    const history = denoiseHistory(
      sortHistory((record.history ?? []).filter((v) => v.effectiveDate || v.documentDate)),
    )
    if (history.length < 2) continue

    for (let i = 1; i < history.length; i++) {
      const was = history[i - 1]
      const now = history[i]
      const frictionDelta = now.frictionIndex - was.frictionIndex
      if (was.status === now.status && Math.abs(frictionDelta) < 6) continue

      const rankDelta = STATUS_RANK[now.status] - STATUS_RANK[was.status]
      let direction: ChangeEvent["direction"]
      let headline: string
      if (STATUS_RANK[was.status] > 1 && STATUS_RANK[now.status] <= 1) {
        direction = "coverage_dropped"
        headline = `${record.stateName} ended its coverage pathway`
      } else if (STATUS_RANK[was.status] <= 1 && STATUS_RANK[now.status] > 1) {
        direction = "coverage_added"
        headline = `${record.stateName} opened a coverage pathway`
      } else if (frictionDelta < 0 || rankDelta > 0) {
        direction = "loosened"
        headline = `${record.stateName} eased access by ${Math.abs(frictionDelta)} friction points`
      } else {
        direction = "tightened"
        headline = `${record.stateName} tightened access by ${frictionDelta} friction points`
      }

      const gained = now.frictionFlags.filter((f) => !was.frictionFlags.includes(f))
      const lost = was.frictionFlags.filter((f) => !now.frictionFlags.includes(f))
      const when = now.effectiveDate ?? now.documentDate ?? detectedAt.slice(0, 10)

      events.push({
        id: `${record.state}-${direction}-${when}`,
        state: record.state,
        stateName: record.stateName,
        direction,
        headline,
        detail: [
          was.status !== now.status
            ? `Status moved from ${was.status.replace(/_/g, " ")} to ${now.status.replace(/_/g, " ")}.`
            : null,
          gained.length ? `Added: ${gained.join(", ").replace(/_/g, " ")}.` : null,
          lost.length ? `Removed: ${lost.join(", ").replace(/_/g, " ")}.` : null,
          was.criteriaVerbatim && now.criteriaVerbatim ? `Criteria language was rewritten.` : null,
        ]
          .filter(Boolean)
          .join(" ") || null,
        fromStatus: was.status,
        toStatus: now.status,
        frictionDelta,
        announcedOn: now.effectiveDate ?? now.documentDate ?? when,
        effectiveOn: now.effectiveDate,
        sourceDoc: now.sourceDoc,
        sourceUrl: now.sourceUrl,
        provenance: "historical",
        detectedAt,
      })
    }
  }

  return events.sort((a, b) => (b.announcedOn ?? "").localeCompare(a.announcedOn ?? ""))
}

/** The dated versions behind one state, newest first — what the compare view shows. */
export function historyFor(record: CoverageRecord | undefined): PolicyVersion[] {
  if (!record) return []
  return sortHistory(record.history ?? []).reverse()
}


/* ---------------------------------------------------- wrong-state guard */

/**
 * Is this excerpt actually about the state we asked about?
 *
 * Search and lead-following both stray across state lines: a query for
 * Colorado's criteria surfaces a North Carolina bulletin that happens to rank,
 * or a state page links out to a neighbour's. The extractor is told "you are
 * reading Colorado's documents" and will dutifully attribute whatever it finds,
 * which is how one state's verbatim prior-authorization language ends up quoted
 * under another's name — the single most damaging error this product can make,
 * because the quote looks authoritative and is precisely wrong.
 *
 * The rule is deliberately permissive: reject only when the target state is
 * absent *and* some other state is named repeatedly. A document that names no
 * state at all is usually a formulary table and is fine.
 */
export function looksLikeWrongState(excerpt: string, stateCode: string): boolean {
  const target = STATE_NAMES[stateCode]
  if (!target) return false
  const text = excerpt.toLowerCase()
  if (text.includes(target.toLowerCase())) return false

  // Policy documents refer to themselves by postal code as often as by name —
  // "NC Medicaid", "TX Vendor Drug Program" — so a name-only check misses the
  // most common form of the mistake.
  const abbreviated = new RegExp(`\\b${stateCode}\\b\\s+(medicaid|medicaid|hhs|dhs|dhhs)`, "i")
  if (abbreviated.test(excerpt)) return false

  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (code === stateCode) continue
    // "Washington" appears inside "Washington, D.C."; require a word boundary.
    const byName = text.match(new RegExp(`\\b${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"))
    if ((byName?.length ?? 0) >= 2) return true
    // One unambiguous "XX Medicaid" for another state is enough on its own.
    if (new RegExp(`\\b${code}\\b\\s+(medicaid|medicaid rx|vendor drug)`, "i").test(excerpt)) return true
  }
  return false
}
