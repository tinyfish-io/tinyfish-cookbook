import type { DriveClient } from "../runner/drive.ts";
import { driveRun } from "../runner/drive.ts";
import type { RunQueue } from "../runner/queue.ts";
import { buildLogoutGoal } from "./goals.ts";
import { LOGOUT_SCHEMA } from "./outputSchema.ts";

const LOGOUT_BUDGET_SECONDS = 120;
const LOGOUT_HARD_LIMIT_MS = 240_000;

const ignore = () => undefined;

export function logoutRunner(client: DriveClient, queue: RunQueue, { pollMs }: { pollMs: number }) {
  return (profileId: string, url: string, proxyCountry: string | null): Promise<boolean> =>
    queue.enqueue(async () => {
      const { run } = await driveRun(
        client,
        {
          url,
          goal: buildLogoutGoal(url),
          maxDurationSeconds: LOGOUT_BUDGET_SECONDS,
          outputSchema: LOGOUT_SCHEMA,
          profileId,
          proxyCountry,
        },
        { onRunId: ignore, onLive: ignore, onStep: ignore, onQuiet: ignore },
        { hardTimeoutMs: LOGOUT_HARD_LIMIT_MS, pollMs, quietMs: LOGOUT_HARD_LIMIT_MS },
      );
      return run?.result?.["logged_out"] === true;
    });
}
