// The browser's view of the scanner's output. Types come straight from the
// agent so the UI and the collector cannot drift apart; everything else here is
// presentation — labels, colours, and the small amount of arithmetic the views
// need that isn't worth a round trip.

import type {
  ChangeEvent,
  ConditionSpec,
  CoverageRecord,
  CoverageStatus,
  DiscoveredSource,
  FrictionFlag,
  PolicyVersion,
  RunLedger,
} from "@/agent/lib/types"
import { FRICTION_LABELS, PEER_OF } from "@/agent/lib/types"

export type { ChangeEvent, ConditionSpec, CoverageRecord, CoverageStatus, DiscoveredSource, FrictionFlag, PolicyVersion, RunLedger }
export { FRICTION_LABELS, PEER_OF }

export type ConditionSummary = ConditionSpec & {
  snapshots: string[]
  lastScannedAt: string | null
  stateCount: number
  changeCount: number
}

export type AtlasPayload = {
  conditionSlug: string
  scannedAt: string
  records: CoverageRecord[]
  sources: DiscoveredSource[]
  ledger: RunLedger
  snapshots: string[]
  outliers: { state: string; stateName: string; kind: string; headline: string; detail: string }[]
}

export type ChangesPayload = {
  days: number
  events: (ChangeEvent & { currentStatus: CoverageStatus | null })[]
  summary: { total: number; widened: number; tightened: number; observed: number; historical: number; reported: number }
}

export const STATUS_LABEL: Record<CoverageStatus, string> = {
  covered: "Covered",
  conditional: "Covered with prior auth",
  limited: "Covered with limits",
  not_covered: "Not covered",
  unpublished: "No published policy",
}

export const STATUS_COLOR: Record<CoverageStatus, string> = {
  covered: "var(--policy-covered)",
  conditional: "var(--policy-conditional)",
  limited: "var(--policy-limited)",
  not_covered: "var(--policy-uncovered)",
  unpublished: "var(--policy-unpublished)",
}

export const AUTH_LABEL: Record<CoverageRecord["authorization"], string> = {
  none: "None",
  prior_authorization: "Prior authorization",
  step_therapy: "Step therapy",
}

export const CONFIDENCE_LABEL: Record<CoverageRecord["confidence"], string> = {
  high: "High",
  moderate: "Moderate",
  review_needed: "Review needed",
}

export const METHOD_LABEL: Record<CoverageRecord["method"], string> = {
  baseline: "Multi-state tracker",
  search: "Search only",
  fetch: "State document (fetch)",
  agent: "Browser agent (stealth)",
  backfill: "State document (followed lead)",
  carried_forward: "Unchanged since last scan",
  inferred: "Inferred — not verified",
}

/** The one method with no source behind it. The UI must always mark it. */
export function isInferred(record: CoverageRecord): boolean {
  return record.method === "inferred"
}

export const PROVENANCE_LABEL: Record<ChangeEvent["provenance"], string> = {
  observed: "Observed by our scanner",
  historical: "From dated policy versions",
  reported: "Publicly reported",
}

export const DIRECTION_LABEL: Record<ChangeEvent["direction"], string> = {
  coverage_added: "Pathway opened",
  coverage_dropped: "Pathway closed",
  loosened: "Access eased",
  tightened: "Access tightened",
  clarified: "Wording clarified",
  stable: "No material change",
}

/**
 * The friction ramp. Deliberately not the status palette: colouring the map by
 * friction is a different question from colouring it by status, and the two
 * should never be mistaken for each other at a glance.
 */
export function frictionColor(index: number): string {
  if (index >= 90) return "var(--friction-5)"
  if (index >= 65) return "var(--friction-4)"
  if (index >= 40) return "var(--friction-3)"
  if (index >= 18) return "var(--friction-2)"
  return "var(--friction-1)"
}

export const FRICTION_BANDS: [label: string, color: string][] = [
  ["Walk-up (0-17)", "var(--friction-1)"],
  ["Light gate (18-39)", "var(--friction-2)"],
  ["Real hurdle (40-64)", "var(--friction-3)"],
  ["Hard (65-89)", "var(--friction-4)"],
  ["No pathway (90+)", "var(--friction-5)"],
]

export function relativeTime(iso: string | null): string {
  if (!iso) return "never"
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(delta / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Headline numbers for the atlas. Recomputed client-side so the view-date control is instant. */
export function summarize(records: CoverageRecord[]) {
  const withPathway = records.filter((r) => r.status !== "not_covered" && r.status !== "unpublished")
  const meanFriction = withPathway.length
    ? Math.round(withPathway.reduce((s, r) => s + r.frictionIndex, 0) / withPathway.length)
    : 0
  const gated = withPathway.filter((r) => r.authorization !== "none").length
  return {
    total: records.length,
    withPathway: withPathway.length,
    noPathway: records.length - withPathway.length,
    meanFriction,
    gated,
    /** The headline the product exists to make: same label, wildly different burden. */
    spread: withPathway.length
      ? Math.max(...withPathway.map((r) => r.frictionIndex)) - Math.min(...withPathway.map((r) => r.frictionIndex))
      : 0,
    needsReview: records.filter((r) => r.confidence === "review_needed").length,
  }
}

/**
 * The comparison that makes the case: among states that all report the *same*
 * coverage status, how far apart are they in what a patient actually faces?
 */
export function frictionSpreadWithinStatus(records: CoverageRecord[], status: CoverageStatus) {
  const group = records.filter((r) => r.status === status)
  if (group.length < 2) return null
  const sorted = [...group].sort((a, b) => a.frictionIndex - b.frictionIndex)
  return {
    count: group.length,
    easiest: sorted[0],
    hardest: sorted[sorted.length - 1],
    spread: sorted[sorted.length - 1].frictionIndex - sorted[0].frictionIndex,
  }
}
