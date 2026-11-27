import { describe, expect, it, vi } from "vite-plus/test";

import { RunQueue } from "../runner/queue.ts";
import { loadRun } from "../testing/fixtures.ts";
import type { RunEvent, RunRequest } from "../tinyfish/client.ts";
import { logoutRunner } from "./logout.ts";

function client(result: Record<string, unknown> | null) {
  const requests: RunRequest[] = [];
  return {
    requests,
    streamRun: async function* (request: RunRequest): AsyncGenerator<RunEvent> {
      requests.push(request);
      yield { type: "started", runId: "run-1" };
      yield { type: "complete", runId: "run-1", status: "COMPLETED" };
    },
    getRun: () => Promise.resolve({ ...loadRun("blinkit-2"), result }),
    cancelRun: vi.fn(() => Promise.resolve()),
  };
}

const timing = { pollMs: 1 };

describe("logoutRunner", () => {
  it("runs a short agent with the profile and reports the logout", async () => {
    const fake = client({ logged_out: true, note: null });
    const logout = logoutRunner(fake, new RunQueue(2), timing);

    expect(await logout("prof_1", "https://shop.test/", "IN")).toBe(true);
    expect(fake.requests[0]).toMatchObject({
      url: "https://shop.test/",
      profileId: "prof_1",
      maxDurationSeconds: 120,
    });
    expect(fake.requests[0]?.goal).toMatch(/log out/i);
  });

  it("does not claim a logout the agent could not confirm", async () => {
    const logout = logoutRunner(client({ logged_out: false }), new RunQueue(2), timing);

    expect(await logout("prof_1", "https://shop.test/", "IN")).toBe(false);
  });

  it("does not claim a logout from a run with no result", async () => {
    const logout = logoutRunner(client(null), new RunQueue(2), timing);

    expect(await logout("prof_1", "https://shop.test/", "IN")).toBe(false);
  });
});
