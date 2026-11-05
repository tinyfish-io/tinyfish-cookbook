import { describe, expect, it, vi } from "vite-plus/test";

import { loadRun } from "../testing/fixtures.ts";
import type { RunEvent, RunRequest } from "../tinyfish/client.ts";
import type { RunRecord } from "../tinyfish/types.ts";
import type { DriveClient, DriveHandlers } from "./drive.ts";
import { driveRun, RunStartError } from "./drive.ts";

const request: RunRequest = {
  url: "https://shop.test",
  goal: "buy",
  maxDurationSeconds: 300,
  proxyCountry: "IN",
};
const fast = { hardTimeoutMs: 5000, pollMs: 1, quietMs: 10_000 };

function handlers() {
  return {
    onRunId: vi.fn(),
    onLive: vi.fn(),
    onStep: vi.fn(),
    onQuiet: vi.fn(),
  } satisfies DriveHandlers;
}

function fakeClient(overrides: Partial<DriveClient>): DriveClient {
  return {
    streamRun: async function* () {
      yield { type: "started", runId: "run-1" };
    },
    getRun: () => Promise.resolve(loadRun("blinkit-2")),
    cancelRun: () => Promise.resolve(),
    ...overrides,
  };
}

function running(): RunRecord {
  return { ...loadRun("blinkit-2"), status: "RUNNING", result: null, steps: [] };
}

describe("driveRun", () => {
  it("relays the stream, then reads the finished record with its steps", async () => {
    const on = handlers();
    const events: RunEvent[] = [
      { type: "started", runId: "run-1" },
      { type: "live", runId: "run-1", streamingUrl: "https://live.test" },
      { type: "progress", runId: "run-1", text: "Open cart", at: "t1" },
      { type: "complete", runId: "run-1", status: "COMPLETED" },
    ];
    const client = fakeClient({
      streamRun: async function* () {
        yield* events;
      },
    });

    const outcome = await driveRun(client, request, on, fast);

    expect(on.onRunId).toHaveBeenCalledWith("run-1");
    expect(on.onLive).toHaveBeenCalledWith("https://live.test");
    expect(on.onStep).toHaveBeenCalledWith("Open cart", "t1");
    expect(outcome.end).toBe("finished");
    expect(outcome.run?.steps).toHaveLength(18);
  });

  it("follows the same run by id when the stream drops, and starts no new one", async () => {
    const on = handlers();
    const streamRun = vi.fn(async function* () {
      yield { type: "started", runId: "run-1" } as RunEvent;
      throw new Error("socket hang up");
    });
    const getRun = vi
      .fn<DriveClient["getRun"]>()
      .mockResolvedValueOnce(running())
      .mockResolvedValue(loadRun("blinkit-2"));

    const outcome = await driveRun(fakeClient({ streamRun, getRun }), request, on, fast);

    expect(streamRun).toHaveBeenCalledTimes(1);
    expect(getRun).toHaveBeenCalledWith("run-1");
    expect(outcome.end).toBe("finished");
  });

  it("keeps showing steps while polling after a drop", async () => {
    const on = handlers();
    const client = fakeClient({
      streamRun: async function* () {
        yield { type: "started", runId: "run-1" };
        yield { type: "progress", runId: "run-1", text: "First", at: "t1" };
        throw new Error("dropped");
      },
      getRun: () => {
        const run = loadRun("blinkit-2");
        run.steps = run.steps.slice(0, 2);
        return Promise.resolve(run);
      },
    });

    await driveRun(client, request, on, fast);

    expect(on.onStep.mock.calls.map(([text]) => text)).toEqual([
      "First",
      loadRun("blinkit-2").steps[1]?.action,
    ]);
  });

  it("rides out a failed poll", async () => {
    const getRun = vi
      .fn<DriveClient["getRun"]>()
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValue(loadRun("blinkit-2"));

    const outcome = await driveRun(fakeClient({ getRun }), request, handlers(), fast);

    expect(outcome.end).toBe("finished");
  });

  it("cancels the run through the API at the hard timeout", async () => {
    const cancelRun = vi.fn(() => Promise.resolve());
    const cancelled = { ...running(), status: "CANCELLED" as const };
    const getRun = vi.fn<DriveClient["getRun"]>(() =>
      Promise.resolve(cancelRun.mock.calls.length > 0 ? cancelled : running()),
    );

    const outcome = await driveRun(fakeClient({ cancelRun, getRun }), request, handlers(), {
      ...fast,
      hardTimeoutMs: 20,
    });

    expect(cancelRun).toHaveBeenCalledWith("run-1");
    expect(outcome.end).toBe("timed_out");
    expect(outcome.run?.status).toBe("CANCELLED");
  });

  it("still reports a timeout when the cancel call itself fails", async () => {
    const outcome = await driveRun(
      fakeClient({
        cancelRun: () => Promise.reject(new Error("nope")),
        getRun: () => Promise.resolve(running()),
      }),
      request,
      handlers(),
      { ...fast, hardTimeoutMs: 20 },
    );

    expect(outcome.end).toBe("timed_out");
  });

  it("cancels when the visitor deletes the audit", async () => {
    const cancelRun = vi.fn(() => Promise.resolve());
    const stop = new AbortController();
    const promise = driveRun(
      fakeClient({ cancelRun, getRun: () => Promise.resolve(running()) }),
      request,
      handlers(),
      { ...fast, signal: stop.signal },
    );

    setTimeout(() => stop.abort(), 10);
    const outcome = await promise;

    expect(cancelRun).toHaveBeenCalledWith("run-1");
    expect(outcome.end).toBe("cancelled");
  });

  it("raises a typed error when the run never started", async () => {
    const client = fakeClient({
      // eslint-disable-next-line require-yield
      streamRun: async function* () {
        throw new Error("insufficient credits");
      },
    });

    await expect(driveRun(client, request, handlers(), fast)).rejects.toBeInstanceOf(RunStartError);
  });

  it("resumes an earlier run by id without opening a stream", async () => {
    const streamRun = vi.fn(async function* () {
      yield { type: "started", runId: "other" } as RunEvent;
    });
    const getRun = vi.fn(() => Promise.resolve(loadRun("blinkit-2")));

    const outcome = await driveRun(fakeClient({ streamRun, getRun }), request, handlers(), {
      ...fast,
      resumeRunId: "run-1",
    });

    expect(streamRun).not.toHaveBeenCalled();
    expect(getRun).toHaveBeenCalledWith("run-1");
    expect(outcome.end).toBe("finished");
  });

  it("says when the agent has gone quiet to write up", async () => {
    const on = handlers();
    const client = fakeClient({
      streamRun: async function* () {
        yield { type: "started", runId: "run-1" };
        await new Promise((resolve) => setTimeout(resolve, 30));
        yield { type: "complete", runId: "run-1", status: "COMPLETED" };
      },
    });

    await driveRun(client, request, on, { ...fast, quietMs: 5 });

    expect(on.onQuiet).toHaveBeenCalled();
  });

  it("keeps saying so while the agent stays quiet, so a later check can still see it", async () => {
    const on = handlers();
    const client = fakeClient({
      streamRun: async function* () {
        yield { type: "started", runId: "run-1" };
        await new Promise((resolve) => setTimeout(resolve, 60));
        yield { type: "complete", runId: "run-1", status: "COMPLETED" };
      },
    });

    await driveRun(client, request, on, { ...fast, quietMs: 10 });

    expect(on.onQuiet.mock.calls.length).toBeGreaterThan(1);
  });
});
