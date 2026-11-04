import { tinyfish } from "./tinyfish";

/** What the pipeline reports about each Agent run (shown on the dashboard). */
export interface AgentRunLog {
  purpose: "portal" | "posting";
  url: string;
  runId: string | null;
  ok: boolean;
  ms: number;
  found: number;
  error: string | null;
  streamingUrl: string | null; // live view of the Agent's browser while it runs
}

export type AgentEvent =
  | { type: "started"; purpose: AgentRunLog["purpose"]; url: string }
  | { type: "live"; url: string; streamingUrl: string }
  | { type: "progress"; url: string; message: string }
  | { type: "done"; log: AgentRunLog };

const RUN_TIMEOUT_MS = 150_000;

/**
 * Agent is metered and slow (~60–90s), so every run goes through a budget:
 * a hard cap on runs per pipeline, and at most 2 in flight (the wallet's concurrency limit).
 */
export class AgentBudget {
  readonly logs: AgentRunLog[] = [];
  private used = 0;
  private active = 0;
  private waiters: (() => void)[] = [];

  constructor(
    readonly max: number,
    private readonly onEvent: (e: AgentEvent) => void = () => {},
    private readonly concurrency = 2,
  ) {}

  get remaining() {
    return this.max - this.used;
  }

  /** Reserve a run up front so parallel callers can't overspend; false when the budget is gone. */
  reserve(): boolean {
    if (this.used >= this.max) return false;
    this.used++;
    return true;
  }

  /** Run one Agent goal (a slot must already be reserved). Never throws. */
  async run(purpose: AgentRunLog["purpose"], url: string, goal: string): Promise<{ result: unknown; log: AgentRunLog }> {
    while (this.active >= this.concurrency) await new Promise<void>((r) => this.waiters.push(r));
    this.active++;
    const t0 = Date.now();
    const log: AgentRunLog = { purpose, url, runId: null, ok: false, ms: 0, found: 0, error: null, streamingUrl: null };
    let result: unknown = null;
    this.onEvent({ type: "started", purpose, url });
    try {
      const stream = await tinyfish().agent.stream(
        { url, goal },
        {
          signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
          onStreamingUrl: (e) => {
            log.streamingUrl = e.streaming_url;
            this.onEvent({ type: "live", url, streamingUrl: e.streaming_url });
          },
          onProgress: (e) => this.onEvent({ type: "progress", url, message: e.purpose }),
        },
      );
      for await (const event of stream) {
        if (event.type === "STARTED") log.runId = event.run_id;
        if (event.type === "COMPLETE") {
          log.runId = event.run_id;
          if (event.status === "COMPLETED" && event.result) {
            result = event.result;
            // COMPLETED doesn't mean the goal succeeded — the goal asks for an "error" field.
            const err = (event.result as { error?: unknown }).error;
            log.error = typeof err === "string" && err ? err : null;
            log.ok = !log.error;
          } else {
            log.error = event.error?.message ?? event.status;
          }
        }
      }
    } catch (err) {
      log.error = (err as Error).name === "TimeoutError" ? `timed out after ${RUN_TIMEOUT_MS / 1000}s` : (err as Error).message;
    } finally {
      log.ms = Date.now() - t0;
      this.active--;
      this.waiters.shift()?.();
    }
    this.logs.push(log);
    return { result, log };
  }

  finish(log: AgentRunLog) {
    this.onEvent({ type: "done", log });
  }
}

export interface AgentListing {
  title: string;
  location: string;
  posted: string;
  url: string;
}

/** Agent: use a JS careers portal's own search (Workday, Ashby, custom sites) and list postings. */
export async function agentSearchPortal(budget: AgentBudget, portalUrl: string, searchTerm: string, limit = 10) {
  const goal = [
    `This is a company careers site. Find open job postings matching "${searchTerm}":`,
    `use the site's search box or filters if it has them, otherwise scan the listed jobs.`,
    `Return up to ${limit} matching postings as JSON:`,
    `{"jobs":[{"title":str,"location":str,"posted":str,"url":str}]}.`,
    `"url" must be the absolute link to the individual posting. Only include postings that match "${searchTerm}".`,
    `If the page is blocked, shows a captcha, or nothing matches, return {"jobs":[],"error":"<reason>"}.`,
  ].join(" ");
  const { result, log } = await budget.run("portal", portalUrl, goal);
  const jobs = (result as { jobs?: AgentListing[] } | null)?.jobs;
  const listings = Array.isArray(jobs) ? jobs.filter((j) => j?.url && j?.title) : [];
  log.found = listings.length;
  budget.finish(log);
  return listings;
}

export interface AgentPosting {
  title: string;
  company: string;
  location: string;
  pay: string;
  description: string;
}

/** Agent: read one posting that Fetch could only see as an empty JS shell. */
export async function agentReadPosting(budget: AgentBudget, url: string): Promise<AgentPosting | null> {
  const goal = [
    "This is a single job posting page. Wait for it to load fully.",
    'Return JSON: {"title":str,"company":str,"location":str,"pay":str,',
    '"description":str}. "description" is the posting\'s full text (responsibilities, qualifications,',
    "dates, visa/sponsorship notes), up to 4000 characters. Use empty strings for missing fields.",
    'If the page is blocked, removed, or shows a captcha, return {"error":"<reason>"}.',
  ].join(" ");
  const { result, log } = await budget.run("posting", url, goal);
  const posting = result as Partial<AgentPosting> | null;
  const ok = log.ok && typeof posting?.description === "string" && posting.description.length > 50;
  log.found = ok ? 1 : 0;
  budget.finish(log);
  if (!ok || !posting) return null;
  return {
    title: posting.title ?? "",
    company: posting.company ?? "",
    location: posting.location ?? "",
    pay: posting.pay ?? "",
    description: posting.description!,
  };
}
