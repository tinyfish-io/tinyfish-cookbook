import { randomBytes, randomUUID } from "node:crypto";

import { ApiError } from "../errors.ts";
import { judgeRun, judgeSavedReport, RULES_VERSION } from "../judge/judge.ts";
import { ranShortOfTime } from "../judge/stop.ts";
import type { Flow, SafetyFlag, SiteReport } from "../judge/types.ts";
import { countryName, proxyCountry } from "../plan/country.ts";
import type { DriveClient, DriveOutcome } from "../runner/drive.ts";
import { driveRun, RunStartError } from "../runner/drive.ts";
import type { RunQueue } from "../runner/queue.ts";
import { QueueCancelledError } from "../runner/queue.ts";
import type { AuditStore } from "../store/auditStore.ts";
import { budgetSeconds, buildGoal, detectFlow } from "./goals.ts";
import { OUTPUT_SCHEMA } from "./outputSchema.ts";
import { isWritingUp } from "./progress.ts";
import { collectPageText } from "./pageCapture.ts";
import { scrubPersonal } from "./scrub.ts";
import { TinyFishError } from "../tinyfish/client.ts";
import type { RunRecord } from "../tinyfish/types.ts";
import type { Audit, SiteRun } from "./types.ts";

export interface AuditClient extends DriveClient {
  getStepHtml(runId: string, stepId: string): Promise<string>;
}

export interface AuditSignIns {
  claim(visitorId: string, signInId: string): string;
  release(signInId: string): Promise<boolean>;
}

export interface Timing {
  pollMs: number;
  /** How long the agent may stay silent before we say it is writing up. */
  quietMs: number;
  /** How long past its budget a run may go before we cancel it. */
  graceMs: number;
}

export const DEFAULT_TIMING: Timing = { pollMs: 5000, quietMs: 45_000, graceMs: 300_000 };

export interface AuditDeps {
  client: AuditClient;
  store: AuditStore;
  queue: RunQueue;
  signIns: AuditSignIns;
  timing?: Timing;
  now?: () => Date;
}

export interface NewAudit {
  visitorId: string;
  task: string;
  flow?: Flow | undefined;
  country?: string | null | undefined;
  city?: string | null | undefined;
  sites: { url: string; signInId?: string | undefined }[];
}

type Listener = (audit: Audit) => void;

const RETRY_STEP = "The site blocked the first try, so this is a fresh run.";
const TIME_RETRY_STEP =
  "The first try ran out of time after finding the product, so this run has longer.";
const KEPT_FLAGS: ReadonlySet<SafetyFlag["kind"]> = new Set([
  "retried_after_block",
  "retried_for_time",
]);

function retryFlag({ stop }: SiteReport): SafetyFlag {
  return {
    kind: "retried_after_block",
    detail:
      stop.at === "blocked"
        ? "The site blocked the first run, and the one fresh retry did not get through."
        : "The site blocked the first run, so Aletheia retried once with a fresh run. This report comes from the second run.",
    stepId: null,
  };
}

function timeFlag(report: SiteReport): SafetyFlag {
  return {
    kind: "retried_for_time",
    detail: ranShortOfTime(report)
      ? "The first run ran out of time after finding the product, and the one longer run did not finish either."
      : "The first run ran out of time after finding the product, so Aletheia ran it once more with longer to go. This report comes from the second run.",
    stepId: null,
  };
}

function missing(): ApiError {
  return new ApiError("not_found", "No audit with that id.");
}

function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

function screenshotsOf({ report }: SiteRun): string[] {
  const shots = [...(report?.pages ?? []), ...(report?.patterns ?? [])].map(
    ({ screenshot }) => screenshot?.stepId,
  );
  return [...new Set(shots.filter((stepId) => stepId !== undefined))];
}

export class AuditService {
  readonly #deps: AuditDeps;
  readonly #timing: Timing;
  readonly #now: () => Date;
  readonly #listeners = new Map<string, Set<Listener>>();
  /** One per site being worked on, keyed by site id. */
  readonly #stops = new Map<string, AbortController>();
  /** Profiles of running checks. Kept out of the audit, so they never reach disk or a browser. */
  readonly #profiles = new Map<string, string>();

  constructor(deps: AuditDeps) {
    this.#deps = deps;
    this.#timing = deps.timing ?? DEFAULT_TIMING;
    this.#now = deps.now ?? (() => new Date());
  }

  async create({
    visitorId,
    task,
    flow,
    country = null,
    city = null,
    sites,
  }: NewAudit): Promise<Audit> {
    const id = randomUUID();
    const audit: Audit = {
      id,
      visitorId,
      task,
      flow: flow ?? detectFlow(task),
      country,
      city,
      createdAt: this.#now().toISOString(),
      status: "running",
      shareToken: null,
      sites: sites.map(({ url, signInId }) => ({
        id: randomUUID(),
        url,
        host: hostOf(url),
        signInId: signInId ?? null,
        state: "queued",
        queuePosition: null,
        runId: null,
        streamingUrl: null,
        steps: [],
        startedAt: null,
        expectedBy: null,
        stopsBy: null,
        finishedAt: null,
        report: null,
        error: null,
        logout: null,
      })),
    };

    this.#claimSignIns(audit);
    await this.#deps.store.save(audit);
    for (const site of audit.sites) this.#launch(audit, site);
    return audit;
  }

  /** Picks up what a restart left behind. A run with an id goes on at TinyFish without us. */
  async resume(): Promise<void> {
    for (const audit of this.#deps.store.all()) {
      if (audit.status !== "running") continue;
      for (const site of audit.sites.filter((entry) => !this.#isOver(entry))) {
        if (site.signInId) await this.#abandon(audit, site);
        else this.#launch(audit, site);
      }
    }
  }

  /** Old audits move to the current pattern set. Reading a finished run costs nothing. */
  async rejudgeSaved(): Promise<void> {
    for (const audit of this.#deps.store.all()) {
      const outdated = audit.sites.filter(
        ({ report, runId }) => report && runId && (report.rules ?? 0) < RULES_VERSION,
      );
      for (const site of outdated) await this.#rejudge(audit, site);
      if (outdated.length > 0) await this.#save(audit);
    }
  }

  async #rejudge(audit: Audit, site: SiteRun): Promise<void> {
    const saved = site.report;
    if (!saved || !site.runId) return;
    try {
      const run = await this.#deps.client.getRun(site.runId);
      const report = await this.#report(audit, site, run);
      site.report = {
        ...report,
        flags: [...report.flags, ...saved.flags.filter((flag) => KEPT_FLAGS.has(flag.kind))],
      };
    } catch (error) {
      // Only a run TinyFish no longer has drops to an older audit. A passing failure must not
      // cost a report its findings, so it keeps the old rules and is tried again next start.
      if (!(error instanceof TinyFishError && error.status === 404)) return;
      site.report = judgeSavedReport(saved);
    }
    this.#publish(audit);
  }

  /** Claiming first means a bad sign-in fails the request, before any run is paid for. */
  #claimSignIns({ visitorId, sites }: Audit): void {
    const claimed: string[] = [];
    try {
      for (const site of sites) {
        if (!site.signInId) continue;
        this.#profiles.set(site.id, this.#deps.signIns.claim(visitorId, site.signInId));
        claimed.push(site.signInId);
      }
    } catch (error) {
      for (const signInId of claimed) {
        this.#deps.signIns.release(signInId).catch(() => undefined);
      }
      for (const site of sites) this.#profiles.delete(site.id);
      throw error;
    }
  }

  /** Profiles are never saved, so a signed-in check cannot go on past a restart. */
  async #abandon(audit: Audit, site: SiteRun): Promise<void> {
    if (site.runId) await this.#deps.client.cancelRun(site.runId).catch(() => undefined);
    site.state = "failed";
    site.error =
      "The server restarted during this signed-in check. Please sign in and run it again.";
    await this.#finish(audit, site);
  }

  get(visitorId: string, id: string): Audit {
    const audit = this.#deps.store.get(id);
    if (audit?.visitorId !== visitorId) throw missing();
    return audit;
  }

  list(visitorId: string): Audit[] {
    return this.#deps.store
      .all()
      .filter((audit) => audit.visitorId === visitorId)
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  subscribe(visitorId: string, id: string, listener: Listener): () => void {
    this.get(visitorId, id);
    const listeners = this.#listeners.get(id) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(id, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(id);
    };
  }

  async remove(visitorId: string, id: string): Promise<void> {
    const audit = this.get(visitorId, id);
    for (const site of audit.sites) this.#stops.get(site.id)?.abort();
    await this.#deps.store.remove(id);
    this.#listeners.delete(id);
  }

  /** One report out of a multi-site audit. The last site takes the audit with it. */
  async removeSite(visitorId: string, id: string, siteId: string): Promise<void> {
    const audit = this.get(visitorId, id);
    const site = audit.sites.find((entry) => entry.id === siteId);
    if (!site) throw missing();
    if (audit.sites.length === 1) {
      await this.remove(visitorId, id);
      return;
    }

    this.#stops.get(site.id)?.abort();
    audit.sites = audit.sites.filter((entry) => entry !== site);
    if (audit.sites.every((entry) => this.#isOver(entry))) audit.status = "finished";
    await this.#deps.store.save(audit);
    await this.#deps.store.removeScreenshots(audit.id, screenshotsOf(site));
    this.#publish(audit);
  }

  async stopCheckUsing(signInId: string): Promise<void> {
    for (const audit of this.#deps.store.all()) {
      const site = audit.sites.find((entry) => entry.signInId === signInId);
      if (site) this.#stops.get(site.id)?.abort();
    }
    await Promise.resolve();
  }

  async share(visitorId: string, id: string): Promise<string> {
    const audit = this.get(visitorId, id);
    audit.shareToken ??= randomBytes(24).toString("base64url");
    await this.#deps.store.save(audit);
    return audit.shareToken;
  }

  shared(token: string): Audit {
    const audit = this.#deps.store.all().find((entry) => entry.shareToken === token);
    if (!audit) throw missing();
    return audit;
  }

  #isOver(site: SiteRun): boolean {
    return site.state === "done" || site.state === "failed" || site.state === "cancelled";
  }

  #launch(audit: Audit, site: SiteRun): void {
    const stop = new AbortController();
    this.#stops.set(site.id, stop);

    this.#deps.queue
      .enqueue(
        () => this.#work(audit, site, stop.signal),
        (position) => {
          site.queuePosition = position;
          this.#publish(audit);
        },
        stop.signal,
      )
      .catch((error: unknown) => this.#failed(site, error))
      .then(() => this.#finish(audit, site))
      .catch(() => undefined);
  }

  async #work(audit: Audit, site: SiteRun, signal: AbortSignal): Promise<void> {
    site.queuePosition = null;
    site.state = "running";
    site.startedAt ??= this.#now().toISOString();
    this.#publish(audit);

    await this.#walk(audit, site, signal).catch(async (error: unknown) => {
      if (!(error instanceof RunStartError) || !proxyCountry(audit.country ?? null)) throw error;
      site.unproxied = true;
      await this.#walk(audit, site, signal);
    });
    await this.#retryIfBlocked(audit, site, signal);
    await this.#retryIfShortOfTime(audit, site, signal);
    if (site.retried && site.report) site.report.flags.push(retryFlag(site.report));
    if (site.extended && site.report) site.report.flags.push(timeFlag(site.report));
  }

  async #retryIfBlocked(audit: Audit, site: SiteRun, signal: AbortSignal): Promise<void> {
    if (site.report?.stop.at !== "blocked" || site.retried || signal.aborted) return;
    site.retried = true;
    await this.#runAgain(audit, site, signal, RETRY_STEP);
  }

  /** A slow site that got as far as the product gets one longer run. One that never did would not. */
  async #retryIfShortOfTime(audit: Audit, site: SiteRun, signal: AbortSignal): Promise<void> {
    const { report } = site;
    if (!report || !ranShortOfTime(report) || site.retried || site.extended) return;
    if (signal.aborted) return;
    site.extended = true;
    await this.#runAgain(audit, site, signal, TIME_RETRY_STEP);
  }

  /** A retry keeps the queue slot it already holds, and a visitor pays for it once. */
  async #runAgain(audit: Audit, site: SiteRun, signal: AbortSignal, note: string): Promise<void> {
    const previous = site.report;
    site.report = null;
    site.runId = null;
    site.streamingUrl = null;
    site.steps = [{ text: note, at: this.#now().toISOString() }];
    site.state = "running";
    this.#publish(audit);
    await this.#save(audit);

    await this.#walk(audit, site, signal).catch((error: unknown) => {
      if (signal.aborted) throw error;
    });
    site.steps = site.steps.filter(({ text }) => text !== note);
    if (!site.report && !signal.aborted) {
      site.report = previous;
      site.state = "done";
      site.error = null;
    }
  }

  async #walk(audit: Audit, site: SiteRun, signal: AbortSignal): Promise<void> {
    const signedIn = site.signInId !== null;
    const budget = budgetSeconds({ task: audit.task, signedIn, extended: site.extended === true });
    const hardTimeoutMs = budget * 1000 + this.#timing.graceMs;
    const now = this.#now().getTime();
    site.expectedBy = new Date(now + budget * 1000).toISOString();
    site.stopsBy = new Date(now + hardTimeoutMs).toISOString();
    const profileId = this.#profiles.get(site.id);
    const country = audit.country ?? null;

    const outcome = await driveRun(
      this.#deps.client,
      {
        url: site.url,
        goal: buildGoal({
          flow: audit.flow,
          task: audit.task,
          url: site.url,
          signedIn,
          today: this.#now(),
          country,
          city: audit.city ?? null,
        }),
        maxDurationSeconds: budget,
        outputSchema: OUTPUT_SCHEMA,
        profileId,
        proxyCountry: site.unproxied ? null : proxyCountry(country),
      },
      {
        onRunId: (runId) => {
          site.runId = runId;
          this.#publish(audit);
          void this.#save(audit);
        },
        onLive: (streamingUrl) => {
          if (site.streamingUrl === streamingUrl) return;
          site.streamingUrl = streamingUrl;
          this.#publish(audit);
        },
        onStep: (text, at) => {
          site.state = "running";
          site.steps.push({ text, at });
          this.#publish(audit);
        },
        onQuiet: () => {
          if (site.state === "writing_up") return;
          if (!isWritingUp(site.steps.at(-1)?.text, this.#now(), site.expectedBy ?? null)) return;
          site.state = "writing_up";
          this.#publish(audit);
        },
      },
      {
        hardTimeoutMs,
        pollMs: this.#timing.pollMs,
        quietMs: this.#timing.quietMs,
        resumeRunId: site.runId,
        signal,
      },
    );

    await this.#judge(audit, site, outcome);
  }

  async #judge(audit: Audit, site: SiteRun, { end, run }: DriveOutcome): Promise<void> {
    if (end === "cancelled") {
      site.state = "cancelled";
      return;
    }
    if (!run) {
      site.state = "failed";
      site.error = "The run could not be read back from TinyFish.";
      return;
    }

    const stopped = end === "timed_out" ? { ...run, status: "CANCELLED" as const } : run;
    site.report = await this.#report(audit, site, stopped);
    site.steps = scrubPersonal(site.steps);
    site.state = "done";
  }

  async #report(audit: Audit, site: SiteRun, run: RunRecord): Promise<SiteReport> {
    const report = judgeRun({
      flow: audit.flow,
      url: site.url,
      run,
      signedIn: site.signInId !== null,
      captures: await collectPageText(this.#deps.client, run),
    });
    const { country } = audit;
    if (country && site.unproxied) {
      report.missing.push(
        `This run could not browse from ${countryName(country)}, so it came from another country and prices may differ.`,
      );
    }
    return scrubPersonal(report);
  }

  #failed(site: SiteRun, error: unknown): void {
    if (error instanceof QueueCancelledError) {
      site.state = "cancelled";
      return;
    }
    site.state = "failed";
    site.error =
      error instanceof RunStartError
        ? `The run could not start: ${error.message}`
        : "The run failed unexpectedly.";
  }

  async #finish(audit: Audit, site: SiteRun): Promise<void> {
    this.#stops.delete(site.id);
    site.queuePosition = null;
    site.streamingUrl = null;
    site.finishedAt = this.#now().toISOString();
    this.#publish(audit);

    if (site.signInId) {
      this.#profiles.delete(site.id);
      const loggedOut = await this.#deps.signIns.release(site.signInId).catch(() => false);
      site.logout = loggedOut ? "logged_out" : "not_confirmed";
    }

    if (audit.sites.every((entry) => this.#isOver(entry))) audit.status = "finished";
    this.#publish(audit);
    if (this.#deps.store.get(audit.id)) await this.#deps.store.save(audit);
  }

  #publish(audit: Audit): void {
    for (const listener of this.#listeners.get(audit.id) ?? []) listener(audit);
  }

  async #save(audit: Audit): Promise<void> {
    if (this.#deps.store.get(audit.id)) await this.#deps.store.save(audit).catch(() => undefined);
  }
}
