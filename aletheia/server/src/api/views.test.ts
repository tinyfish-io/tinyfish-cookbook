import { describe, expect, it } from "vite-plus/test";

import type { Audit, SiteRun } from "../audit/types.ts";
import { ownerView, summaryView } from "./views.ts";

function site(overrides: Partial<SiteRun>): SiteRun {
  return {
    id: "s1",
    url: "https://plans.test/",
    host: "plans.test",
    signInId: null,
    state: "running",
    queuePosition: null,
    runId: "run_1",
    streamingUrl: "https://live.test/1",
    steps: [],
    startedAt: "2026-11-04T06:30:00.000Z",
    expectedBy: "2026-11-04T06:35:00.000Z",
    stopsBy: "2026-11-04T06:40:00.000Z",
    finishedAt: null,
    report: null,
    error: null,
    logout: null,
    ...overrides,
  };
}

function audit(sites: SiteRun[]): Audit {
  return {
    id: "a1",
    visitorId: "visitor",
    task: "Sign up for a design plan",
    flow: "subscription",
    createdAt: "2026-11-04T06:29:50.000Z",
    status: "running",
    shareToken: null,
    sites,
  };
}

describe("summaryView", () => {
  it("gives a running site's newest step and its timing, for the list of past audits", () => {
    const steps = [
      { text: "Opened the home page", at: "2026-11-04T06:30:10.000Z" },
      { text: "Opened the plans page", at: "2026-11-04T06:31:00.000Z" },
    ];
    const [row] = summaryView(audit([site({ steps })])).sites;

    expect(row).toMatchObject({
      stepCount: 2,
      latestStep: "Opened the plans page",
      startedAt: "2026-11-04T06:30:00.000Z",
      expectedBy: "2026-11-04T06:35:00.000Z",
      stopsBy: "2026-11-04T06:40:00.000Z",
    });
  });

  it("has no timing for a site saved before it was kept", () => {
    const { expectedBy: _expected, stopsBy: _stops, ...older } = site({});
    const [row] = summaryView(audit([older])).sites;

    expect(row).toMatchObject({ stepCount: 0, latestStep: null, expectedBy: null, stopsBy: null });
  });
});

describe("site names", () => {
  const known = site({ url: "https://www.bestbuy.ca/", host: "bestbuy.ca" });

  it("names a known site the way the brand does, on every view", () => {
    expect(summaryView(audit([known])).sites[0]?.name).toBe("Best Buy");
    expect(ownerView(audit([known])).sites[0]?.name).toBe("Best Buy");
  });

  it("leaves the name empty for a site the brand data does not know", () => {
    expect(ownerView(audit([site({})])).sites[0]?.name).toBeNull();
  });
});
