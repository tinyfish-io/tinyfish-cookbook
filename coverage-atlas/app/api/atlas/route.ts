import { findOutliers } from "@/agent/lib/derive"
import { listSnapshotStamps, readChanges, readSnapshot, readSnapshotAsOf } from "@/agent/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Everything one view of the atlas needs, in one response: the records as of a
 * point in time, the sources behind them, the computed outliers, and the run
 * ledger that produced them.
 *
 * `asOf` is what makes the view-date control real rather than decorative — it
 * resolves to the newest snapshot at or before that timestamp, so picking an
 * earlier date shows what the scanner actually believed then, not a filtered
 * version of what it believes now.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const slug = params.get("condition")
  if (!slug) return Response.json({ error: "condition required" }, { status: 400 })

  const asOf = params.get("asOf")
  const snapshot = asOf ? await readSnapshotAsOf(slug, asOf) : await readSnapshot(slug)
  if (!snapshot) return Response.json({ error: "no snapshot yet", records: [] }, { status: 404 })

  const changes = await readChanges(slug)
  const stamps = await listSnapshotStamps(slug)

  return Response.json({
    conditionSlug: slug,
    scannedAt: snapshot.scannedAt,
    records: snapshot.records,
    sources: snapshot.sources,
    ledger: snapshot.ledger,
    snapshots: stamps,
    outliers: findOutliers(snapshot.records, changes),
  })
}
