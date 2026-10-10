import { scan, type ScanEvent } from "@/agent/orchestrator"

export const runtime = "nodejs"
export const maxDuration = 800

/**
 * Run a scan and stream it.
 *
 * The whole point of streaming this rather than returning a finished payload is
 * that a fifty-state scan takes minutes and the interesting part is watching the
 * map fill in. Each state lands as its own event, so the choropleth repaints
 * jurisdiction by jurisdiction and the plan — how many states the shared read
 * settled, how many needed their own subagent — is visible while it happens
 * rather than asserted afterwards in a README.
 */
export async function POST(request: Request) {
  if (!process.env.TINYFISH_API_KEY) return Response.json({ error: "TINYFISH_API_KEY is not set" }, { status: 500 })
  if (!process.env.OPENROUTER_API_KEY) return Response.json({ error: "OPENROUTER_API_KEY is not set" }, { status: 500 })

  let body: { condition?: string; depth?: "baseline" | "standard" | "deep"; agentBudget?: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "body must be {condition, depth?}" }, { status: 400 })
  }
  const condition = (body.condition ?? "").trim()
  if (!condition) return Response.json({ error: "condition required" }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (event: ScanEvent) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // The viewer navigated away. The scan keeps running headless — it is
          // writing a snapshot either way, and a half-written scan is worse than
          // one nobody watched.
          closed = true
        }
      }
      try {
        controller.enqueue(encoder.encode(": ping\n\n")) // defeat proxy buffering
      } catch {
        closed = true
      }

      try {
        await scan({
          condition,
          depth: body.depth ?? "standard",
          agentBudget: body.agentBudget ?? 6,
          onEvent: send,
        })
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) })
      } finally {
        if (!closed) {
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
