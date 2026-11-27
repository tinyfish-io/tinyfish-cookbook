import { getCondition, mergeChanges, patchLatestRecord, readSnapshot } from "@/agent/lib/store"
import { runSubagent } from "@/agent/phases/subagent"
import { STATE_NAMES } from "@/agent/lib/types"
import { Budget } from "@/agent/lib/budget"
import { LeadPool } from "@/agent/lib/leads"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Check one state again, right now.
 *
 * The atlas is only as good as its last look, so every record carries a
 * "verified" timestamp and every record can be re-checked on demand. This runs
 * the same subagent the sweep uses, with a browser-run budget of one so it will
 * escalate through the stealth agent if the state portal refuses a plain fetch —
 * which many of them do.
 *
 * If the answer disagrees with what we hold, that disagreement is written to the
 * change feed as an observed event. A scanner that quietly corrects itself is
 * hiding the most interesting thing it does.
 */
export async function POST(request: Request) {
  if (!process.env.TINYFISH_API_KEY) return Response.json({ error: "TINYFISH_API_KEY is not set" }, { status: 500 })
  if (!process.env.OPENROUTER_API_KEY) return Response.json({ error: "OPENROUTER_API_KEY is not set" }, { status: 500 })

  let body: { state?: string; condition?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "body must be {state, condition}" }, { status: 400 })
  }

  const state = (body.state ?? "").toUpperCase()
  const slug = body.condition ?? ""
  if (!STATE_NAMES[state]) return Response.json({ error: `unknown state ${state}` }, { status: 400 })

  const spec = await getCondition(slug)
  if (!spec) return Response.json({ error: `unknown condition ${slug}` }, { status: 404 })
  const snapshot = await readSnapshot(slug)
  const prior = snapshot?.records.find((r) => r.state === state)

  const startedAt = Date.now()
  try {
    // A single-state re-check gets a small budget of its own: enough calls to
    // walk the ladder once, including one stealth browser run if the state's
    // portal refuses a plain fetch.
    const outcome = await runSubagent({
      state,
      spec,
      baseline: undefined,
      prior,
      budget: new Budget({ maxTinyfishCalls: 6, maxSteps: 4, maxAgentRuns: 1 }),
      leads: new LeadPool(),
    })
    const record = outcome.record
    await patchLatestRecord(slug, record)

    const statusChanged = Boolean(prior && prior.status !== record.status)
    const frictionDelta = prior ? record.frictionIndex - prior.frictionIndex : 0
    const material = statusChanged || Math.abs(frictionDelta) >= 6

    if (material && prior) {
      const detectedAt = new Date().toISOString()
      await mergeChanges(slug, [
        {
          id: `${state}-verify-${detectedAt.slice(0, 10)}`,
          state,
          stateName: record.stateName,
          direction: frictionDelta > 0 ? "tightened" : frictionDelta < 0 ? "loosened" : "clarified",
          headline: `${record.stateName} re-verified: ${prior.status.replace("_", " ")} → ${record.status.replace("_", " ")}`,
          detail: record.criteriaSummary,
          fromStatus: prior.status,
          toStatus: record.status,
          frictionDelta,
          announcedOn: detectedAt.slice(0, 10),
          effectiveOn: record.effectiveDate,
          sourceDoc: record.sourceDoc,
          sourceUrl: record.sourceUrl,
          provenance: "observed",
          detectedAt,
        },
      ])
    }

    return Response.json({
      ok: true,
      record,
      changed: material,
      method: record.method,
      escalated: outcome.agentRuns > 0,
      shortCircuited: outcome.shortCircuited,
      durationMs: Date.now() - startedAt,
    })
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
}
