import { NextRequest } from "next/server";
import { runSweepStreaming } from "@/lib/sweep";
import { dispatchSweepWorkflow } from "@/lib/github";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Used by the "Sync now" button. On Vercel, a real 5-bank sweep with
// retries can genuinely take longer than any serverless function duration
// limit — when that happens, the platform kills the connection mid-stream,
// and naive "the stream just ended" logic on the frontend can wrongly
// read that as success. So on Vercel this dispatches to GitHub Actions
// instead (no execution time limit there) and returns immediately; the
// frontend's regular polling of /api/state picks up progress from there,
// same as it already does for the scheduled daily run. Local dev keeps
// the original live inline stream, since Node here has no such limit and
// it's a nicer interactive experience while building.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      if (process.env.VERCEL) {
        const dispatched = await dispatchSweepWorkflow();
        if (dispatched) {
          send("dispatched", { message: "Triggered the GitHub Actions sweep — this can take a few minutes." });
        } else {
          send("error", {
            message: "GITHUB_TOKEN/GITHUB_REPO aren't configured, so this can't dispatch on Vercel (and running the real sweep inline here would risk being killed by the platform's execution limit)."
          });
        }
        controller.close();
        return;
      }

      try {
        await runSweepStreaming(send);
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "sweep failed" });
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
