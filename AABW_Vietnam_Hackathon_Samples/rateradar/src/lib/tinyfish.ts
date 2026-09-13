import { TinyFish } from "@tiny-fish/sdk";

let client: TinyFish | null = null;

export function getTinyFishClient(): TinyFish | null {
  const apiKey = process.env.TINYFISH_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client) client = new TinyFish({ apiKey });
  return client;
}

// Polls client.runs.get(run_id) until the queued agent run finishes.
// TinyFish's own guidance: agent.run() is synchronous and only meant for
// short (<30s) tasks — anything involving real multi-step site navigation
// (our competitor sweeps) should use agent.queue() + poll instead.
//
export async function pollRun(
  client: TinyFish,
  runId: string,
  { intervalMs = 3000, timeoutMs = 280000 }: { intervalMs?: number; timeoutMs?: number } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let consecutiveConnectionErrors = 0;

  while (Date.now() < deadline) {
    let run;
    try {
      run = await client.runs.get(runId);
      consecutiveConnectionErrors = 0; // a good poll resets the counter
    } catch (err) {
      // A single dropped connection (fetch failed, ECONNRESET, etc.) over a
      // multi-minute polling window is a transient network blip, not proof
      // the run itself failed — don't let one bad packet throw away 3+
      // minutes of an otherwise-successful agent run. Only give up after
      // several consecutive failures, which would indicate something more
      // persistent (e.g. the network is actually down).
      consecutiveConnectionErrors++;
      console.error(`[TinyFish] poll for run ${runId} hit a connection error (attempt ${consecutiveConnectionErrors}), retrying:`, err);
      if (consecutiveConnectionErrors >= 5) {
        throw new Error(`TinyFish polling failed after ${consecutiveConnectionErrors} consecutive connection errors — this looks like a real network problem, not a flaky single request: ${err instanceof Error ? err.message : err}`);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }

    if (run.status === "COMPLETED") return run;
    if (run.status === "FAILED" || run.status === "CANCELLED") {
      throw new Error(`TinyFish run ${run.status.toLowerCase()}: ${run.error?.message ?? "unknown error"}`);
    }
    // The status field has been observed getting stuck reporting a
    // non-terminal value long after TinyFish's own dashboard already shows
    // the run as Completed (confirmed directly: dashboard showed
    // "Completed" with a real duration and credit cost, while this exact
    // polling loop kept reading a stale status for 10+ minutes). Don't
    // trust that field alone — if the real result payload has already
    // shown up, treat the run as done regardless of what status says.
    if (run.result && Object.keys(run.result as object).length > 0) {
      console.log(`[TinyFish] result payload present despite status=${run.status} — treating run ${runId} as complete`);
      return run;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `TinyFish run timed out waiting for completion after ${Math.round(timeoutMs / 1000)}s — status field never reached a terminal value and no result payload appeared`
  );
}
