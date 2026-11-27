import { deleteCondition, listConditions, listSnapshotStamps, readChanges, readSnapshot } from "@/agent/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** The condition switcher, with enough metadata to render freshness without a second round trip. */
export async function GET() {
  const conditions = await listConditions()
  const enriched = await Promise.all(
    conditions.map(async (spec) => {
      const stamps = await listSnapshotStamps(spec.slug)
      const latest = stamps.length ? await readSnapshot(spec.slug) : null
      const changes = await readChanges(spec.slug)
      return {
        ...spec,
        snapshots: stamps,
        lastScannedAt: latest?.scannedAt ?? null,
        stateCount: latest?.records.length ?? 0,
        changeCount: changes.length,
      }
    }),
  )
  return Response.json({ conditions: enriched })
}

export async function DELETE(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")
  if (!slug) return Response.json({ error: "slug required" }, { status: 400 })
  const removed = await deleteCondition(slug)
  if (!removed) return Response.json({ error: "built-in conditions cannot be removed" }, { status: 400 })
  return Response.json({ ok: true })
}
