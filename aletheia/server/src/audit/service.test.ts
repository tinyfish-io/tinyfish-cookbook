import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { RULES_VERSION } from "../judge/judge.ts";
import { RunStartError } from "../runner/drive.ts";
import { RunQueue } from "../runner/queue.ts";
import { AuditStore } from "../store/auditStore.ts";
import { loadRun } from "../testing/fixtures.ts";
import type { RunEvent, RunRequest } from "../tinyfish/client.ts";
import { TinyFishError } from "../tinyfish/client.ts";
import type { RunRecord } from "../tinyfish/types.ts";
import type { AuditClient, AuditSignIns } from "./service.ts";
import { AuditService } from "./service.ts";
import type { Audit } from "./types.ts";

const SITE = "https://shop.test/";
const timing = { pollMs: 1, quietMs: 10_000, graceMs: 5000 };

function clientFor(run: RunRecord, overrides: Partial<AuditClient> = {}): AuditClient {
  return {
    streamRun: async function* (): AsyncGenerator<RunEvent> {
      yield { type: "started", runId: run.run_id };
      yield { type: "live", runId: run.run_id, streamingUrl: "https://live.test/1" };
      yield { type: "progress", runId: run.run_id, text: "Open the cart", at: "t1" };
      yield { type: "complete", runId: run.run_id, status: run.status };
    },
    getRun: () => Promise.resolve(run),
    cancelRun: () => Promise.resolve(),
    getStepHtml: () => Promise.resolve(""),
    ...overrides,
  };
}

describe("AuditService", () => {
  let dataDir: string;
  let store: AuditStore;

  function service(client: AuditClient, signIns?: AuditSignIns, limit = 2) {
    return new AuditService({
      client,
      store,
      queue: new RunQueue(limit),
      signIns: signIns ?? {
        claim: () => "prof_1",
        release: () => Promise.resolve(true),
      },
      timing,
      now: () => new Date("2026-11-01T06:30:00Z"),
    });
  }

  async function finished(audits: AuditService, id: string, visitor = "visitor"): Promise<Audit> {
    await vi.waitFor(() => {
      expect(audits.get(visitor, id).status).toBe("finished");
    });
    return audits.get(visitor, id);
  }

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "aletheia-audit-"));
    store = new AuditStore(dataDir);
    await store.load();
  });

  afterEach(async () => {
    // A finished audit's last save can still be landing, and Windows refuses a folder in use.
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  it("walks a site to a judged report", async () => {
    const audits = service(clientFor(loadRun("blinkit-2")));

    const created = await audits.create({
      visitorId: "visitor",
      task: "buy one pair of headphones",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, created.id);
    const [site] = audit.sites;

    expect(audit.flow).toBe("checkout");
    expect(site?.state).toBe("done");
    expect(site?.steps.map((step) => step.text)).toContain("Open the cart");
    expect(site?.report?.bill.total).toBe(81);
    expect(site?.report?.host).toBe("shop.test");
  });

  it("browses from the audit's country and keeps it on the audit", async () => {
    const client = clientFor(loadRun("blinkit-2"));
    const streamRun = vi.fn((request: RunRequest) => client.streamRun(request));
    const audits = service({ ...client, streamRun });

    const created = await audits.create({
      visitorId: "visitor",
      task: "buy one pair of headphones",
      country: "GB",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, created.id);

    expect(audit.country).toBe("GB");
    const [request] = streamRun.mock.calls[0] as unknown as [RunRequest];
    expect(request.proxyCountry).toBe("GB");
    expect(request.goal).toContain("SW1A 1AA");
    expect(audit.sites[0]?.report?.missing.join(" ")).not.toMatch(/browse from/);
  });

  it("tells the agent the visitor's city and keeps it on the audit", async () => {
    const client = clientFor(loadRun("blinkit-2"));
    const streamRun = vi.fn((request: RunRequest) => client.streamRun(request));
    const audits = service({ ...client, streamRun });

    const created = await audits.create({
      visitorId: "visitor",
      task: "buy one pair of headphones",
      country: "IN",
      city: "Pune, Maharashtra",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, created.id);

    const [request] = streamRun.mock.calls[0] as unknown as [RunRequest];
    expect(request.goal).toContain("Pune, Maharashtra");
    expect(audit.city).toBe("Pune, Maharashtra");
  });

  it("runs from elsewhere and says so when the country's browser will not start", async () => {
    const run = loadRun("blinkit-2");
    const client = clientFor(run);
    const streamRun = vi.fn((request: RunRequest) => {
      if (request.proxyCountry === "BR") throw new RunStartError("unknown country_code");
      return client.streamRun(request);
    });
    const audits = service({ ...client, streamRun });

    const created = await audits.create({
      visitorId: "visitor",
      task: "buy one pair of headphones",
      country: "BR",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, created.id);

    const [request] = streamRun.mock.calls[1] as unknown as [RunRequest];
    expect(request.proxyCountry).toBeNull();
    expect(audit.sites[0]?.report?.missing).toContain(
      "This run could not browse from Brazil, so it came from another country and prices may differ.",
    );
  });

  it("checks agent quotes against the page text captured in the run", async () => {
    const run = loadRun("adobe-subscription");
    run.steps[0] = { ...(run.steps[0] as RunRecord["steps"][number]), html: "url" };
    const getStepHtml = vi.fn(() =>
      Promise.resolve(
        "<p>Fee applies of half your remaining annual commitment if you cancel after Nov 14</p>",
      ),
    );
    const audits = service(clientFor(run, { getStepHtml }));

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "subscribe to the plan",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, id);
    const fee = audit.sites[0]?.report?.patterns.find((entry) => entry.id === "cancellation_fee");

    expect(getStepHtml).toHaveBeenCalledOnce();
    expect(fee?.status).toBe("found");
    expect(JSON.stringify(audit)).not.toContain("<p>");
  });

  it("still reports when the page text cannot be fetched", async () => {
    const run = loadRun("adobe-subscription");
    run.steps[0] = { ...(run.steps[0] as RunRecord["steps"][number]), html: "url" };
    const audits = service(
      clientFor(run, { getStepHtml: () => Promise.reject(new Error("gone")) }),
    );

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "subscribe to the plan",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, id);
    const fee = audit.sites[0]?.report?.patterns.find((entry) => entry.id === "cancellation_fee");

    expect(audit.sites[0]?.state).toBe("done");
    expect(fee?.status).toBe("not_checked");
  });

  describe("reports saved under older rules", () => {
    const FEE = "half your remaining annual commitment";

    let failure: Error | null = null;

    async function saved() {
      failure = null;
      const run = loadRun("adobe-subscription");
      const terms = (run.result?.["terms"] ?? []) as { term: string; quote: string }[];
      const fee = terms.find(({ term }) => term === "cancellation_fee");
      run.steps[5] = { ...(run.steps[5] as RunRecord["steps"][number]), html: "url" };
      const audits = service(
        clientFor(run, {
          getRun: () => (failure ? Promise.reject(failure) : Promise.resolve(run)),
          getStepHtml: () => Promise.resolve(`<p>${fee?.quote}</p>`),
        }),
      );
      const { id } = await audits.create({
        visitorId: "visitor",
        task: "subscribe to the plan",
        sites: [{ url: SITE }],
      });
      const audit = await finished(audits, id);
      const site = audit.sites[0];
      if (!site?.report) throw new Error("no report");
      site.report.rules = 1;
      await store.save(audit);
      return {
        audits,
        id,
        findings: site.report.patterns.filter(({ status }) => status === "found"),
      };
    }

    it("judges them again from the saved run", async () => {
      const { audits, id } = await saved();

      await audits.rejudgeSaved();
      const report = audits.get("visitor", id).sites[0]?.report;

      expect(report?.rules).toBe(RULES_VERSION);
      expect(report?.patterns.find(({ id: name }) => name === "cancellation_fee")?.quote).toContain(
        FEE,
      );
    });

    it("leaves a report under the current rules alone", async () => {
      const { audits, id } = await saved();
      await audits.rejudgeSaved();
      const first = audits.get("visitor", id).sites[0]?.report;

      await audits.rejudgeSaved();

      expect(audits.get("visitor", id).sites[0]?.report).toBe(first);
    });

    it("keeps every finding when TinyFish fails for a moment, and tries again next start", async () => {
      const { audits, id, findings } = await saved();
      failure = new TinyFishError("Upstream timed out", 504);

      await audits.rejudgeSaved();
      const report = audits.get("visitor", id).sites[0]?.report;

      expect(findings.length).toBeGreaterThan(0);
      expect(report?.patterns.filter(({ status }) => status === "found")).toEqual(findings);
      expect(report?.rules).toBe(1);
      expect(report?.older).not.toBe(true);
    });

    it("marks the report as an older audit and claims no quote when the run is gone", async () => {
      const { audits, id } = await saved();
      failure = new TinyFishError("Run not found", 404, "NOT_FOUND");

      await audits.rejudgeSaved();
      const report = audits.get("visitor", id).sites[0]?.report;

      expect(report?.rules).toBe(RULES_VERSION);
      expect(report?.pages.length).toBeGreaterThan(0);
      expect(report?.patterns.length).toBeGreaterThan(0);
      expect(report?.patterns.every(({ status }) => status === "not_checked")).toBe(true);
      expect(report?.older).toBe(true);
    });
  });

  describe("a site that blocks the agent", () => {
    const blocked = (runId: string): RunRecord => ({ ...loadRun("ajio"), run_id: runId });

    /** Plays one saved run per start, the way TinyFish hands out a fresh run each time. */
    function playing(runs: RunRecord[], overrides: Partial<AuditClient> = {}) {
      const starts: string[] = [];
      const budgets: number[] = [];
      const client = clientFor(loadRun("blinkit-2"), {
        streamRun: async function* (request: RunRequest): AsyncGenerator<RunEvent> {
          const run = runs[starts.length];
          if (!run) throw new RunStartError("No more saved runs");
          starts.push(run.run_id);
          budgets.push(request.maxDurationSeconds);
          yield { type: "started", runId: run.run_id };
          yield { type: "progress", runId: run.run_id, text: "Open the site", at: "t1" };
          yield { type: "complete", runId: run.run_id, status: run.status };
        },
        getRun: (runId) => {
          const run = runs.find((entry) => entry.run_id === runId);
          return run ? Promise.resolve(run) : Promise.reject(new Error("No such run"));
        },
        ...overrides,
      });
      return { client, starts, budgets };
    }

    async function audit(client: AuditClient) {
      const audits = service(client);
      const { id } = await audits.create({
        visitorId: "visitor",
        task: "buy one pair of headphones",
        sites: [{ url: SITE }],
      });
      return (await finished(audits, id)).sites[0];
    }

    it("retries once with a fresh run, and reports the run that got through", async () => {
      const good = loadRun("blinkit-2");
      const { client, starts } = playing([blocked("run-blocked"), good]);

      const site = await audit(client);

      expect(starts).toEqual(["run-blocked", good.run_id]);
      expect(site?.state).toBe("done");
      expect(site?.runId).toBe(good.run_id);
      expect(site?.report?.stop.at).not.toBe("blocked");
      expect(site?.report?.bill.total).toBe(81);
      expect(site?.report?.flags).toContainEqual({
        kind: "retried_after_block",
        detail:
          "The site blocked the first run, so Aletheia retried once with a fresh run. This report comes from the second run.",
        stepId: null,
      });
    });

    it("stops after one retry and says both runs were turned away", async () => {
      const { client, starts } = playing([blocked("run-1"), blocked("run-2"), blocked("run-3")]);

      const site = await audit(client);

      expect(starts).toEqual(["run-1", "run-2"]);
      expect(site?.runId).toBe("run-2");
      expect(site?.report?.stop.at).toBe("blocked");
      expect(site?.report?.flags.map((flag) => flag.detail)).toContain(
        "The site blocked the first run, and the one fresh retry did not get through.",
      );
    });

    it("keeps the blocked report when the retry cannot start", async () => {
      const { client, starts } = playing([blocked("run-1")]);

      const site = await audit(client);

      expect(starts).toEqual(["run-1"]);
      expect(site?.state).toBe("done");
      expect(site?.error).toBeNull();
      expect(site?.report?.stop.at).toBe("blocked");
    });

    describe("a run that runs out of time after finding the product", () => {
      const ranOut = (runId: string, price: number | null): RunRecord => {
        const run = { ...loadRun("blinkit-page-never-loaded"), run_id: runId };
        run.result = {
          ...run.result,
          item_listed_price: price,
          stop_note: "Budget exhausted while opening the product page.",
        };
        return run;
      };

      it("runs once more with longer to go, and says why", async () => {
        const good = loadRun("blinkit-2");
        const { client, starts, budgets } = playing([ranOut("run-short", 499), good]);

        const site = await audit(client);

        expect(starts).toEqual(["run-short", good.run_id]);
        expect(budgets[1]).toBeGreaterThan(budgets[0] ?? Infinity);
        expect(site?.report?.bill.total).toBe(81);
        expect(site?.report?.flags.map((flag) => flag.kind)).toContain("retried_for_time");
      });

      it("tries for time only once", async () => {
        const { client, starts } = playing([ranOut("run-1", 499), ranOut("run-2", 499)]);

        const site = await audit(client);

        expect(starts).toEqual(["run-1", "run-2"]);
        expect(site?.report?.stop.at).toBe("incomplete");
      });

      it("gives a run that never found a price no second try, since more time would not help", async () => {
        const { client, starts } = playing([ranOut("run-1", null), loadRun("blinkit-2")]);

        await audit(client);

        expect(starts).toEqual(["run-1"]);
      });
    });

    it("does not retry a site that was not blocked", async () => {
      const good = loadRun("croma");
      const { client, starts } = playing([good, blocked("run-2")]);

      const site = await audit(client);

      expect(starts).toEqual([good.run_id]);
      expect(site?.report?.flags.map((flag) => flag.kind)).not.toContain("retried_after_block");
    });

    it("says so on the live steps, and counts only the second run's steps at the end", async () => {
      const good = loadRun("blinkit-2");
      const { client } = playing([blocked("run-1"), good]);
      const audits = service(client);
      const { id } = await audits.create({
        visitorId: "visitor",
        task: "buy one pair of headphones",
        sites: [{ url: SITE }],
      });
      const seen: string[] = [];
      audits.subscribe("visitor", id, (live) => {
        seen.push(...(live.sites[0]?.steps.map((step) => step.text) ?? []));
      });

      const site = (await finished(audits, id)).sites[0];
      const unblocked = await audit(playing([good]).client);

      expect(seen).toContain("The site blocked the first try, so this is a fresh run.");
      expect(site?.steps.map((step) => step.text)).toEqual(
        unblocked?.steps.map((step) => step.text),
      );
    });

    it("does not retry again when a restart lands on the retry", async () => {
      const { client, starts } = playing([blocked("run-2"), blocked("run-3")]);
      const saved = await store.save({
        id: "resumed",
        visitorId: "visitor",
        task: "buy one pair of headphones",
        flow: "checkout",
        country: null,
        createdAt: "2026-11-02T00:00:00.000Z",
        status: "running",
        shareToken: null,
        sites: [
          {
            id: "site-1",
            url: SITE,
            host: "shop.test",
            signInId: null,
            state: "running",
            queuePosition: null,
            runId: "run-2",
            retried: true,
            streamingUrl: null,
            steps: [],
            startedAt: null,
            finishedAt: null,
            report: null,
            error: null,
            logout: null,
          },
        ],
      });
      expect(saved).toBeUndefined();

      const audits = service(client);
      await audits.resume();
      const site = (await finished(audits, "resumed")).sites[0];

      expect(starts).toEqual([]);
      expect(site?.report?.stop.at).toBe("blocked");
      expect(site?.report?.flags.map((flag) => flag.kind)).toContain("retried_after_block");
    });
  });

  it("runs one agent per site, each told to stay on its site", async () => {
    const goals: RunRequest[] = [];
    const run = loadRun("blinkit-2");
    const base = clientFor(run);
    const audits = service({
      ...base,
      streamRun(request, signal) {
        goals.push(request);
        return base.streamRun(request, signal);
      },
    });

    const created = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: "https://a.test/" }, { url: "https://b.test/" }],
    });
    await finished(audits, created.id);

    expect(goals.map((request) => request.url)).toEqual(["https://a.test/", "https://b.test/"]);
    expect(goals[0]?.goal).toContain("Work only on https://a.test/");
    expect(goals[1]?.goal).toContain("Work only on https://b.test/");
  });

  it("gives guests 300 seconds", async () => {
    const seen: RunRequest[] = [];
    const base = clientFor(loadRun("blinkit-2"));
    const audits = service({
      ...base,
      streamRun(request, signal) {
        seen.push(request);
        return base.streamRun(request, signal);
      },
    });

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    await finished(audits, id);

    expect(seen[0]?.maxDurationSeconds).toBe(300);
    expect(seen[0]?.profileId).toBeUndefined();
  });

  it("says when a run should finish and when it will be stopped at the latest", async () => {
    const audits = service(clientFor(loadRun("blinkit-2")));

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    const [site] = (await finished(audits, id)).sites;

    // Now is 6:30:00 AM, guests get 300 seconds, and the test grace is 5 seconds.
    expect(site?.expectedBy).toBe("2026-11-01T06:35:00.000Z");
    expect(site?.stopsBy).toBe("2026-11-01T06:35:05.000Z");
  });

  it("drops the live browser link once a run ends", async () => {
    const audits = service(clientFor(loadRun("blinkit-2")));

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, id);

    expect(audit.sites[0]?.streamingUrl).toBeNull();
  });

  it("publishes each change, ending with the finished audit", async () => {
    const audits = service(clientFor(loadRun("blinkit-2")));
    const seen: string[] = [];

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    audits.subscribe("visitor", id, (audit) => seen.push(audit.status));
    await finished(audits, id);

    expect(seen.at(-1)).toBe("finished");
  });

  it("saves no phone number or email the agent wrote down", async () => {
    const run = loadRun("blinkit-2");
    if (run.result) run.result["stop_note"] = "Deliver to 9876543210, mail me@example.com";
    const audits = service(clientFor(run));

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, id);

    expect(JSON.stringify(audit)).not.toMatch(/9876543210|me@example/);
  });

  it("reports a site that never started, and still finishes the audit", async () => {
    const audits = service(
      clientFor(loadRun("blinkit-2"), {
        // eslint-disable-next-line require-yield
        streamRun: async function* () {
          throw new Error("Insufficient credits");
        },
      }),
    );

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, id);

    expect(audit.sites[0]?.state).toBe("failed");
    expect(audit.sites[0]?.error).toMatch(/could not start/i);
  });

  it("reports a run over its hard limit as incomplete and says what is missing", async () => {
    const running = { ...loadRun("blinkit-2"), status: "RUNNING" as const, result: null };
    const audits = new AuditService({
      client: clientFor(running, {
        streamRun: async function* () {
          yield { type: "started", runId: "run-1" };
        },
      }),
      store,
      queue: new RunQueue(2),
      signIns: { claim: () => "prof_1", release: () => Promise.resolve(true) },
      timing: { ...timing, graceMs: -299_950 },
      now: () => new Date(),
    });

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    const audit = await finished(audits, id);
    const report = audit.sites[0]?.report;

    expect(audit.sites[0]?.state).toBe("done");
    expect(report?.stop.at).toBe("incomplete");
    expect(report?.missing.join(" ")).toMatch(/time limit/i);
  });

  describe("signed-in checks", () => {
    function signIns() {
      return {
        claim: vi.fn(() => "prof_1"),
        release: vi.fn(() => Promise.resolve(true)),
      } satisfies AuditSignIns;
    }

    it("runs with the profile, a longer budget, then logs out and deletes", async () => {
      const seen: RunRequest[] = [];
      const base = clientFor(loadRun("zomato-signed-in-2"));
      const session = signIns();
      const audits = service(
        {
          ...base,
          streamRun(request, signal) {
            seen.push(request);
            return base.streamRun(request, signal);
          },
        },
        session,
      );

      const { id } = await audits.create({
        visitorId: "visitor",
        task: "buy one biryani",
        sites: [{ url: SITE, signInId: "signin-1" }],
      });
      const audit = await finished(audits, id);

      expect(session.claim).toHaveBeenCalledWith("visitor", "signin-1");
      expect(seen[0]?.profileId).toBe("prof_1");
      expect(seen[0]?.maxDurationSeconds).toBe(450);
      expect(seen[0]?.goal).toMatch(/stop on the payment-method page/i);
      expect(session.release).toHaveBeenCalledWith("signin-1");
      expect(audit.sites[0]?.report?.signedIn).toBe(true);
      expect(audit.sites[0]?.logout).toBe("logged_out");
    });

    it("still logs out when the run fails", async () => {
      const session = signIns();
      const audits = service(
        clientFor(loadRun("blinkit-2"), {
          // eslint-disable-next-line require-yield
          streamRun: async function* () {
            throw new Error("boom");
          },
        }),
        session,
      );

      const { id } = await audits.create({
        visitorId: "visitor",
        task: "buy a laptop",
        sites: [{ url: SITE, signInId: "signin-1" }],
      });
      await finished(audits, id);

      expect(session.release).toHaveBeenCalledWith("signin-1");
    });

    it("says so when the logout could not be confirmed", async () => {
      const session = signIns();
      session.release.mockResolvedValueOnce(false);
      const audits = service(clientFor(loadRun("zomato-signed-in-2")), session);

      const { id } = await audits.create({
        visitorId: "visitor",
        task: "buy a laptop",
        sites: [{ url: SITE, signInId: "signin-1" }],
      });
      const audit = await finished(audits, id);

      expect(audit.sites[0]?.logout).toBe("not_confirmed");
    });

    it("stops the running check when the visitor signs out", async () => {
      const running = { ...loadRun("blinkit-2"), status: "RUNNING" as const, result: null };
      const cancelRun = vi.fn(() => Promise.resolve());
      const session = signIns();
      const audits = service(
        clientFor(running, {
          cancelRun,
          streamRun: async function* () {
            yield { type: "started", runId: "run-1" };
          },
        }),
        session,
      );

      const { id } = await audits.create({
        visitorId: "visitor",
        task: "buy a laptop",
        sites: [{ url: SITE, signInId: "signin-1" }],
      });
      await vi.waitFor(() => {
        expect(audits.get("visitor", id).sites[0]?.runId).toBe("run-1");
      });
      await audits.stopCheckUsing("signin-1");
      await finished(audits, id);

      expect(cancelRun).toHaveBeenCalledWith("run-1");
      expect(session.release).toHaveBeenCalledOnce();
    });
  });

  it("hands back claimed sign-ins when a later one cannot be claimed", async () => {
    const session = {
      claim: vi.fn((_visitor: string, id: string) => {
        if (id === "bad") throw new Error("not ready");
        return "prof_1";
      }),
      release: vi.fn(() => Promise.resolve(true)),
    };
    const audits = service(clientFor(loadRun("blinkit-2")), session);

    await expect(
      audits.create({
        visitorId: "visitor",
        task: "buy a laptop",
        sites: [
          { url: "https://a.test/", signInId: "good" },
          { url: "https://b.test/", signInId: "bad" },
        ],
      }),
    ).rejects.toThrow("not ready");

    expect(session.release).toHaveBeenCalledWith("good");
    expect(audits.list("visitor")).toEqual([]);
  });

  it("ends a signed-in check cut off by a restart, since its profile is gone", async () => {
    const cancelRun = vi.fn(() => Promise.resolve());
    const base = clientFor(loadRun("blinkit-2"));
    const streamRun = vi.fn(base.streamRun.bind(base));
    const client = clientFor(loadRun("blinkit-2"), { cancelRun, streamRun });
    const first = service(client);
    const { id } = await first.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE, signInId: "signin-1" }],
    });
    await finished(first, id);

    const interrupted = first.get("visitor", id);
    const [site] = interrupted.sites;
    if (site) {
      site.state = "running";
      site.report = null;
      site.runId = "run-1";
    }
    interrupted.status = "running";
    await store.save(interrupted);
    streamRun.mockClear();

    const restarted = service(client);
    await restarted.resume();
    const audit = await finished(restarted, id);

    expect(cancelRun).toHaveBeenCalledWith("run-1");
    expect(streamRun).not.toHaveBeenCalled();
    expect(audit.sites[0]?.state).toBe("failed");
    expect(audit.sites[0]?.error).toMatch(/restart/i);
  });

  it("keeps audits to their owner", async () => {
    const audits = service(clientFor(loadRun("blinkit-2")));

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    await finished(audits, id);

    expect(() => audits.get("stranger", id)).toThrow(/not found|no audit/i);
    expect(audits.list("stranger")).toEqual([]);
    expect(audits.list("visitor")).toHaveLength(1);
  });

  it("deletes an audit, cancelling its run, and it stays deleted", async () => {
    const running = { ...loadRun("blinkit-2"), status: "RUNNING" as const, result: null };
    const cancelRun = vi.fn(() => Promise.resolve());
    const audits = service(
      clientFor(running, {
        cancelRun,
        streamRun: async function* () {
          yield { type: "started", runId: "run-1" };
        },
      }),
    );

    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    await vi.waitFor(() => {
      expect(audits.get("visitor", id).sites[0]?.runId).toBe("run-1");
    });

    await audits.remove("visitor", id);
    await vi.waitFor(() => {
      expect(cancelRun).toHaveBeenCalledWith("run-1");
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(audits.list("visitor")).toEqual([]);
    const reloaded = new AuditStore(dataDir);
    await reloaded.load();
    expect(reloaded.get(id)).toBeNull();
  });

  it("follows a run again after a restart instead of starting a new one", async () => {
    const run = loadRun("blinkit-2");
    const base = clientFor(run);
    const streamRun = vi.fn(base.streamRun.bind(base));
    const client = clientFor(run, { streamRun });
    const first = service(client);
    const { id } = await first.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    await finished(first, id);

    const interrupted = first.get("visitor", id);
    const [site] = interrupted.sites;
    if (site) {
      site.state = "running";
      site.report = null;
      site.runId = "run-1";
    }
    interrupted.status = "running";
    await store.save(interrupted);
    streamRun.mockClear();

    const restarted = service(client);
    await restarted.resume();
    const audit = await finished(restarted, id);

    expect(streamRun).not.toHaveBeenCalled();
    expect(audit.sites[0]?.report?.bill.total).toBe(81);
  });

  it("shares a finished audit by a token nobody can guess", async () => {
    const audits = service(clientFor(loadRun("blinkit-2")));
    const { id } = await audits.create({
      visitorId: "visitor",
      task: "buy a laptop",
      sites: [{ url: SITE }],
    });
    await finished(audits, id);

    const token = await audits.share("visitor", id);

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(audits.shared(token).id).toBe(id);
  });
});
