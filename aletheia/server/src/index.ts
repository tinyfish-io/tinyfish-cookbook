import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { Hono } from "hono";

import type { ApiEnv } from "./api/routes.ts";
import { createApi } from "./api/routes.ts";
import { createApp } from "./app.ts";
import { logoutRunner } from "./audit/logout.ts";
import { AuditService, DEFAULT_TIMING } from "./audit/service.ts";
import type { Config } from "./config.ts";
import { loadConfig } from "./config.ts";
import { RunQueue } from "./runner/queue.ts";
import { SitePlanner } from "./plan/planner.ts";
import { openLoginBrowser } from "./signin/loginBrowser.ts";
import { SignInService } from "./signin/service.ts";
import { AuditStore } from "./store/auditStore.ts";
import { TinyFishClient } from "./tinyfish/client.ts";

import { siteAnswers } from "./plan/probe.ts";

const CONCURRENT_RUNS = 2;
const SWEEP_INTERVAL_MS = 60_000;

async function startApi(apiKey: string, { dataDir }: Config) {
  const client = new TinyFishClient({ apiKey });
  const store = new AuditStore(dataDir);
  await store.load();

  const queue = new RunQueue(CONCURRENT_RUNS);
  const signIns = new SignInService({
    client,
    openBrowser: openLoginBrowser,
    runLogout: logoutRunner(client, queue, DEFAULT_TIMING),
    dataDir,
  });
  const audits = new AuditService({ client, store, queue, signIns });
  signIns.onSignOutDuringCheck((id) => audits.stopCheckUsing(id));

  // Audits first: a signed-in check cut off by the restart has to end before its profile goes.
  await audits.resume();
  void audits.rejudgeSaved();
  await signIns.recover();
  setInterval(() => void signIns.sweep().catch(() => undefined), SWEEP_INTERVAL_MS).unref();

  const planner = new SitePlanner((query, country) => client.search(query, country), siteAnswers);
  return createApi({ audits, signIns, store, queue, client, planner });
}

/** The site still serves without a key, so a missing variable shows up as a clear API answer. */
function unconfiguredApi(): Hono<ApiEnv> {
  const api = new Hono<ApiEnv>();
  api.all("*", (c) => c.json({ error: "not_configured", message: "Audits are not set up." }, 503));
  return api;
}

const config = loadConfig();
const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));
const api = config.tinyfishApiKey
  ? await startApi(config.tinyfishApiKey, config)
  : unconfiguredApi();

serve({ fetch: createApp({ webRoot, api }).fetch, port: config.port }, ({ port }) => {
  console.log(`Aletheia listening on port ${port}`);
});
