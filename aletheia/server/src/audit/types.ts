import type { Flow, SiteReport } from "../judge/types.ts";

export type SiteState = "queued" | "running" | "writing_up" | "done" | "failed" | "cancelled";

export interface SiteStep {
  text: string;
  at: string;
}

export type LogoutResult = "logged_out" | "not_confirmed";

export interface SiteRun {
  id: string;
  url: string;
  host: string;
  signInId: string | null;
  state: SiteState;
  queuePosition: number | null;
  runId: string | null;
  /** The site blocked a run and this one fresh run followed. Saved so a restart adds no third. */
  retried?: boolean;
  /** Ran once more with a longer limit, after the first run ran short of time. */
  extended?: boolean;
  /** The country's browser would not start, so this run came from elsewhere. */
  unproxied?: boolean;
  streamingUrl: string | null;
  steps: SiteStep[];
  startedAt: string | null;
  /** When the agent's own time limit runs out. Most runs end near it, some a little after. */
  expectedBy?: string | null;
  /** When the runner cancels the run at the latest, whatever the agent is doing. */
  stopsBy?: string | null;
  finishedAt: string | null;
  report: SiteReport | null;
  error: string | null;
  logout: LogoutResult | null;
}

export interface Audit {
  id: string;
  visitorId: string;
  task: string;
  flow: Flow;
  /** Null for a worldwide audit. Saved audits from before countries have none. */
  country?: string | null;
  /** Where the visitor was, for delivery. Never shared, since a report link can travel. */
  city?: string | null;
  createdAt: string;
  status: "running" | "finished";
  shareToken: string | null;
  sites: SiteRun[];
}
