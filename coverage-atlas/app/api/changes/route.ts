import { readChanges, readSnapshot } from "@/agent/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The change feed, windowed and summarised.
 *
 * Sorted by how much the change moved access, not by date: a state closing its
 * only pathway matters more than three states rewording a form, however recent
 * the rewording is.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const slug = params.get("condition")
  if (!slug) return Response.json({ error: "condition required" }, { status: 400 })

  const days = Number(params.get("days") ?? 90)
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const all = await readChanges(slug)
  const windowed = all.filter((e) => (e.announcedOn ?? e.detectedAt.slice(0, 10)) >= cutoff)

  const snapshot = await readSnapshot(slug)
  const byState = new Map((snapshot?.records ?? []).map((r) => [r.state, r]))

  const ranked = [...windowed].sort((a, b) => {
    const weight = (x: typeof a) =>
      (x.direction === "coverage_dropped" || x.direction === "coverage_added" ? 1000 : 0) + Math.abs(x.frictionDelta)
    return weight(b) - weight(a) || (b.announcedOn ?? "").localeCompare(a.announcedOn ?? "")
  })

  return Response.json({
    days,
    events: ranked.map((e) => ({ ...e, currentStatus: byState.get(e.state)?.status ?? null })),
    summary: {
      total: ranked.length,
      widened: ranked.filter((e) => e.direction === "coverage_added" || e.direction === "loosened").length,
      tightened: ranked.filter((e) => e.direction === "coverage_dropped" || e.direction === "tightened").length,
      observed: ranked.filter((e) => e.provenance === "observed").length,
      historical: ranked.filter((e) => e.provenance === "historical").length,
      reported: ranked.filter((e) => e.provenance === "reported").length,
    },
  })
}
