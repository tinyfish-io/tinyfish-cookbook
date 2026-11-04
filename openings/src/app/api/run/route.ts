import { runPipeline } from "@/lib/pipeline";
import { runRequestSchema, type RunEvent } from "@/lib/run";
import { clientKey, deepSearchAllowed, rateLimit } from "@/lib/guard";

export const maxDuration = 300;

/**
 * Runs the pipeline and streams progress as newline-delimited JSON, so the dashboard can show
 * each stage (and the Agent's live browser) while the run is still going.
 */
export async function POST(request: Request) {
  const parsed = runRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid preferences", issues: parsed.error.issues }, { status: 400 });
  }
  const { agentRuns, passcode, ...prefs } = parsed.data;

  // Cost guard for the public deploy (guard.ts): per-client rate limit, passcode for metered deep search.
  if (agentRuns > 0 && !deepSearchAllowed(passcode)) {
    return Response.json(
      { error: "Deep search is locked on this deployment — enter the passcode or scan without it.", code: "deep_search_locked" },
      { status: 403 },
    );
  }
  const limit = rateLimit(clientKey(request));
  if (!limit.ok) {
    return Response.json(
      { error: `Too many scans — try again in ${Math.ceil(limit.retryAfter / 60)} min.`, code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  const started = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RunEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Client disconnected; the run finishes but nobody is listening.
        }
      };
      try {
        const result = await runPipeline(prefs, {
          readLimit: 15,
          agentRuns,
          onProgress: (stage, message, done) => send({ type: "progress", stage, message, done, at: Date.now() - started }),
          onAgentEvent: (event) => send({ type: "agent", event, at: Date.now() - started }),
        });
        send({ type: "result", result });
      } catch (err) {
        console.error("[run]", err);
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
