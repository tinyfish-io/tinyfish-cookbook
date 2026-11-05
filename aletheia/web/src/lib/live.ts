import { clock } from "./format.ts";
import type { AuditPublic, SiteView } from "./types.ts";

export type SiteTone = "waiting" | "live" | "stopped" | "done";

export interface SiteStatus {
  label: string;
  tone: SiteTone;
}

export function siteStatus({
  state,
  queuePosition,
  error,
}: Pick<SiteView, "state" | "queuePosition" | "error">): SiteStatus {
  switch (state) {
    case "queued":
      return {
        label:
          queuePosition === null
            ? "Waiting for a free agent"
            : `Waiting for a free agent, number ${queuePosition} in line`,
        tone: "waiting",
      };
    case "running":
      return { label: "Walking the site", tone: "live" };
    case "writing_up":
      return { label: "Writing up the report", tone: "live" };
    case "done":
      return { label: "Report ready", tone: "done" };
    case "failed":
      return { label: error ?? "The run failed.", tone: "stopped" };
    case "cancelled":
      return { label: "Stopped before it finished", tone: "stopped" };
  }
}

export function auditIsLive({ status }: Pick<AuditPublic, "status">): boolean {
  return status === "running";
}

type Timing = Pick<SiteView, "state" | "startedAt" | "expectedBy" | "stopsBy">;

const MINUTE_MS = 60_000;

function elapsed(startedAt: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(startedAt)) / MINUTE_MS);
  return minutes < 1 ? "Just started" : `${minutes} min in`;
}

/**
 * Counts down to the agent's own time limit, which is where most runs end. Past it, the only
 * promise worth making is the runner's hard stop.
 */
export function timeEstimate(
  { state, startedAt, expectedBy, stopsBy }: Timing,
  now: number,
): string | null {
  if ((state !== "running" && state !== "writing_up") || !startedAt) return null;
  const sofar = elapsed(startedAt, now);
  const latest = stopsBy && Date.parse(stopsBy) > now ? clock(stopsBy) : null;

  if (state === "writing_up") return latest ? `${sofar}. Done by ${latest} at the latest` : sofar;
  if (!expectedBy) return sofar;

  const left = Math.ceil((Date.parse(expectedBy) - now) / MINUTE_MS);
  if (left > 1) return `${sofar}, about ${left} min to go`;
  if (left === 1) return `${sofar}, about a minute to go`;
  return latest
    ? `${sofar}. Running long, it stops by ${latest} at the latest`
    : `${sofar}. Running long`;
}

const MOST = 0.95;

/** How much of the agent's time limit is used, for a bar that never claims more than it knows. */
export function progressShare(
  { state, startedAt, expectedBy }: Timing,
  now: number,
): number | null {
  if (state === "writing_up") return 1;
  if (state !== "running" || !startedAt || !expectedBy) return null;
  const start = Date.parse(startedAt);
  const share = (now - start) / (Date.parse(expectedBy) - start);
  return Math.min(Math.max(share, 0), MOST);
}

export function stepLine(count: number, text: string | null): string | null {
  return count > 0 && text ? `Step ${count}: ${text}` : null;
}
