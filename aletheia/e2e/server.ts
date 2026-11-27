import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { chromium } from "@playwright/test";

import { createApi } from "../server/src/api/routes.ts";
import { createApp } from "../server/src/app.ts";
import { AuditService } from "../server/src/audit/service.ts";
import { SitePlanner } from "../server/src/plan/planner.ts";
import { RunQueue } from "../server/src/runner/queue.ts";
import { openLoginBrowser } from "../server/src/signin/loginBrowser.ts";
import { SignInService } from "../server/src/signin/service.ts";
import { AuditStore } from "../server/src/store/auditStore.ts";
import { loadRun, pageOf, withSavedPages } from "../server/src/testing/fixtures.ts";
import type { RunEvent, RunRequest } from "../server/src/tinyfish/client.ts";
import { serveLoginSite } from "./loginSite.ts";

/**
 * The real app with TinyFish replaced by saved runs, so the test costs nothing and is repeatable.
 * Sign-in runs for real: a local Chromium stands in for the setup browser, reached over CDP as the
 * real one is, and each `<flow>.test` address maps to the same path on the pretend login site.
 */
const SAVED_RUNS: Record<string, string> = {
  "adobe.com": "adobe-subscription",
  "linkedin.com": "linkedin-subscription",
};
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
/** Long enough to see a running audit, short enough to keep the suite quick. */
const RUN_HOLD_MS = 3000;
const PORT = Number(process.env["E2E_PORT"] ?? 4173);
const LOGIN_SITE_PORT = PORT + 1;
const BROWSER_PORT = PORT + 2;

function savedRun(url: string) {
  const { hostname } = new URL(url);
  const site = hostname.endsWith(".test") ? "linkedin.com" : hostname.replace(/^www\./, "");
  const name = SAVED_RUNS[site];
  if (!name) throw new Error(`No saved run for ${url}`);
  return withSavedPages(loadRun(name));
}

function localLoginUrl(url: string): string {
  const { hostname, pathname } = new URL(url);
  return `http://localhost:${LOGIN_SITE_PORT}/${hostname.replace(/\.test$/, "")}${pathname}`;
}

const runsById = new Map(
  Object.values(SAVED_RUNS).map((name) => {
    const run = withSavedPages(loadRun(name));
    return [run.run_id, run];
  }),
);

const client = {
  async *streamRun({ url }: RunRequest): AsyncGenerator<RunEvent> {
    const run = savedRun(url);
    yield { type: "started", runId: run.run_id };
    // A blank page, as the real live browser is before its first frame.
    yield {
      type: "live",
      runId: run.run_id,
      streamingUrl: `http://localhost:${LOGIN_SITE_PORT}/live/`,
    };
    // Sign-in checks need no live browser, so their runs end at once and the suite stays quick.
    if (!new URL(url).hostname.endsWith(".test")) {
      await new Promise((resolve) => setTimeout(resolve, RUN_HOLD_MS));
    }
    for (const step of run.steps.slice(0, 3)) {
      yield { type: "progress", runId: run.run_id, text: step.action ?? "", at: step.timestamp };
    }
    yield { type: "complete", runId: run.run_id, status: run.status };
  },
  async getRun(runId: string) {
    const run = runsById.get(runId);
    if (!run) throw new Error(`No saved run ${runId}`);
    return run;
  },
  cancelRun: () => Promise.resolve(),
  getStepHtml: (runId: string) => {
    const run = runsById.get(runId);
    return Promise.resolve(run ? pageOf(run) : "");
  },
  getScreenshot: () => Promise.resolve(JPEG),
  createProfile: () => Promise.resolve("prof_e2e"),
  deleteProfile: () => Promise.resolve(),
  startSetup: (_profileId: string, url: string) =>
    Promise.resolve({
      sessionId: url,
      cdpUrl: `http://127.0.0.1:${BROWSER_PORT}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
  saveSetup: () => Promise.resolve(),
  cancelSetup: () => Promise.resolve(),
};

serveLoginSite(LOGIN_SITE_PORT);
const setupBrowser = await chromium.launch({ args: [`--remote-debugging-port=${BROWSER_PORT}`] });

/** Each sign-in gets its own tab, as each gets its own browser for real. */
async function openFreshBrowser(cdpUrl: string) {
  await (await setupBrowser.newContext()).newPage();
  const login = await openLoginBrowser(cdpUrl);
  return {
    ...login,
    goto: (url: string) => login.goto(localLoginUrl(url)),
  };
}

const dataDir = await mkdtemp(join(tmpdir(), "aletheia-e2e-"));
const store = new AuditStore(dataDir);
await store.load();

const queue = new RunQueue(2);
const signIns = new SignInService({
  client,
  openBrowser: openFreshBrowser,
  runLogout: () => Promise.resolve(true),
  dataDir,
  guided: { settlePolls: 6 },
});
const audits = new AuditService({ client, store, queue, signIns });

const webRoot = fileURLToPath(new URL("../web/dist", import.meta.url));
const planner = new SitePlanner(() => Promise.resolve([]));
const limits = { perVisitor: 10_000, perAddress: 10_000 };
const api = createApi({ audits, signIns, store, queue, client, planner, limits });
serve({ fetch: createApp({ webRoot, api }).fetch, port: PORT });
