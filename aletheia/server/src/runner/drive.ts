import { setTimeout as sleep } from "node:timers/promises";

import type { RunEvent, RunRequest } from "../tinyfish/client.ts";
import type { RunRecord } from "../tinyfish/types.ts";
import { isTerminal } from "../tinyfish/types.ts";

export interface DriveClient {
  streamRun(request: RunRequest, signal?: AbortSignal): AsyncIterable<RunEvent>;
  getRun(runId: string): Promise<RunRecord>;
  cancelRun(runId: string): Promise<void>;
}

export interface DriveHandlers {
  onRunId(runId: string): void;
  onLive(streamingUrl: string): void;
  onStep(text: string, at: string): void;
  /** The agent has stopped acting: results arrive minutes later, so show "writing up". */
  onQuiet(): void;
}

export interface DriveOptions {
  hardTimeoutMs: number;
  pollMs: number;
  quietMs: number;
  resumeRunId?: string | null | undefined;
  signal?: AbortSignal | undefined;
}

export type DriveEnd = "finished" | "timed_out" | "cancelled";

export interface DriveOutcome {
  end: DriveEnd;
  run: RunRecord | null;
}

export class RunStartError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RunStartError";
  }
}

class QuietWatch {
  readonly #ms: number;
  readonly #onQuiet: () => void;
  #timer: NodeJS.Timeout | undefined;

  constructor(ms: number, onQuiet: () => void) {
    this.#ms = ms;
    this.#onQuiet = onQuiet;
  }

  reset(): void {
    this.stop();
    this.#timer = setTimeout(() => {
      this.#onQuiet();
      this.reset();
    }, this.#ms);
  }

  stop(): void {
    clearTimeout(this.#timer);
  }
}

/**
 * Follows one run to its end. The stream is only the fast path: if it drops, the same run is
 * followed by id, because the run goes on at TinyFish whether or not anyone is listening.
 */
export async function driveRun(
  client: DriveClient,
  request: RunRequest,
  on: DriveHandlers,
  { hardTimeoutMs, pollMs, quietMs, resumeRunId, signal }: DriveOptions,
): Promise<DriveOutcome> {
  const deadline = AbortSignal.timeout(hardTimeoutMs);
  const stopped = signal ? AbortSignal.any([deadline, signal]) : deadline;
  const quiet = new QuietWatch(quietMs, () => on.onQuiet());

  let runId = resumeRunId ?? null;
  let stepsShown = 0;

  const showStep = (text: string, at: string) => {
    stepsShown += 1;
    quiet.reset();
    on.onStep(text, at);
  };

  const readStream = async () => {
    for await (const event of client.streamRun(request, stopped)) {
      switch (event.type) {
        case "started":
          runId = event.runId;
          quiet.reset();
          on.onRunId(event.runId);
          break;
        case "live":
          on.onLive(event.streamingUrl);
          break;
        case "progress":
          showStep(event.text, event.at);
          break;
        case "complete":
          return;
      }
    }
  };

  const pollToEnd = async (id: string): Promise<RunRecord | null> => {
    while (!stopped.aborted) {
      const run = await client.getRun(id).catch(() => null);
      if (run) {
        for (const step of run.steps.slice(stepsShown)) {
          if (step.action && step.status === "RUNNING") showStep(step.action, step.timestamp);
        }
        if (isTerminal(run.status)) return run;
        if (run.streaming_url) on.onLive(run.streaming_url);
      }
      await sleep(pollMs, undefined, { signal: stopped }).catch(() => undefined);
    }
    return null;
  };

  try {
    if (runId === null) {
      try {
        await readStream();
      } catch (error) {
        if (runId === null && !stopped.aborted) {
          throw new RunStartError(
            error instanceof Error ? error.message : "The run did not start",
            {
              cause: error,
            },
          );
        }
      }
    } else {
      on.onRunId(runId);
    }

    if (runId === null) {
      if (stopped.aborted) return { end: signal?.aborted ? "cancelled" : "timed_out", run: null };
      throw new RunStartError("The stream ended before the run started");
    }

    const finished = await pollToEnd(runId);
    if (finished) return { end: "finished", run: finished };

    await client.cancelRun(runId).catch(() => undefined);
    const last = await client.getRun(runId).catch(() => null);
    return { end: signal?.aborted ? "cancelled" : "timed_out", run: last };
  } finally {
    quiet.stop();
  }
}
