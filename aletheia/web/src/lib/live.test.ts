import { describe, expect, it } from "vite-plus/test";

import { clock } from "./format.ts";
import { auditIsLive, progressShare, siteStatus, stepLine, timeEstimate } from "./live.ts";

describe("siteStatus", () => {
  it("gives the queue position", () => {
    expect(siteStatus({ state: "queued", queuePosition: 2, error: null })).toEqual({
      label: "Waiting for a free agent, number 2 in line",
      tone: "waiting",
    });
  });

  it("says it is queued before a position is known", () => {
    expect(siteStatus({ state: "queued", queuePosition: null, error: null }).label).toBe(
      "Waiting for a free agent",
    );
  });

  it("marks a running site as live", () => {
    expect(siteStatus({ state: "running", queuePosition: null, error: null })).toEqual({
      label: "Walking the site",
      tone: "live",
    });
  });

  it("has a clear end state while the agent writes up", () => {
    expect(siteStatus({ state: "writing_up", queuePosition: null, error: null })).toEqual({
      label: "Writing up the report",
      tone: "live",
    });
  });

  it("shows the reason a run failed", () => {
    expect(siteStatus({ state: "failed", queuePosition: null, error: "It broke." })).toEqual({
      label: "It broke.",
      tone: "stopped",
    });
  });

  it("has a fallback when a failure gives no reason", () => {
    expect(siteStatus({ state: "failed", queuePosition: null, error: null }).label).toBe(
      "The run failed.",
    );
  });

  it("says a cancelled run stopped", () => {
    expect(siteStatus({ state: "cancelled", queuePosition: null, error: null })).toEqual({
      label: "Stopped before it finished",
      tone: "stopped",
    });
  });
});

describe("auditIsLive", () => {
  it("is live until the server says finished", () => {
    expect(auditIsLive({ status: "running" })).toBe(true);
    expect(auditIsLive({ status: "finished" })).toBe(false);
  });
});

const START = "2026-11-04T06:30:00.000Z";
const at = (seconds: number) => Date.parse(START) + seconds * 1000;
const timing = {
  state: "running" as const,
  startedAt: START,
  expectedBy: "2026-11-04T06:35:00.000Z",
  stopsBy: "2026-11-04T06:40:00.000Z",
};

describe("timeEstimate", () => {
  it("counts down to the agent's own limit while it walks the site", () => {
    expect(timeEstimate(timing, at(130))).toBe("2 min in, about 3 min to go");
  });

  it("says when it has just started", () => {
    expect(timeEstimate(timing, at(20))).toBe("Just started, about 5 min to go");
  });

  it("says a minute when that is all that is left", () => {
    expect(timeEstimate(timing, at(250))).toBe("4 min in, about a minute to go");
  });

  it("owns up to a long run and gives the latest it can end", () => {
    expect(timeEstimate(timing, at(320))).toBe(
      `5 min in. Running long, it stops by ${clock(timing.stopsBy)} at the latest`,
    );
  });

  it("gives the latest end while the report is written up", () => {
    expect(timeEstimate({ ...timing, state: "writing_up" }, at(200))).toBe(
      `3 min in. Done by ${clock(timing.stopsBy)} at the latest`,
    );
  });

  it("only counts the time for a run saved before its limits were kept", () => {
    expect(timeEstimate({ ...timing, expectedBy: null, stopsBy: null }, at(130))).toBe("2 min in");
  });

  it("says nothing before the run starts or after it ends", () => {
    expect(timeEstimate({ ...timing, state: "queued", startedAt: null }, at(0))).toBeNull();
    expect(timeEstimate({ ...timing, state: "done" }, at(400))).toBeNull();
  });
});

describe("stepLine", () => {
  it("numbers the newest step so the reader can follow along", () => {
    expect(stepLine(7, "Opened the plans page")).toBe("Step 7: Opened the plans page");
  });

  it("has nothing before the first step", () => {
    expect(stepLine(0, null)).toBeNull();
  });
});

describe("progressShare", () => {
  it("fills with the time used of the agent's own limit", () => {
    expect(progressShare(timing, at(150))).toBeCloseTo(0.5);
  });

  it("never claims to be done while the agent still walks", () => {
    expect(progressShare(timing, at(900))).toBe(0.95);
  });

  it("is full while the report is written up", () => {
    expect(progressShare({ ...timing, state: "writing_up" }, at(200))).toBe(1);
  });

  it("has no bar without a limit to measure against", () => {
    expect(progressShare({ ...timing, expectedBy: null }, at(100))).toBeNull();
  });
});
