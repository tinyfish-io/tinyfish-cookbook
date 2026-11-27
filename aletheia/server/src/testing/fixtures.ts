import { readFileSync } from "node:fs";

import type { PageCapture } from "../judge/pageText.ts";
import { comparable } from "../judge/pageText.ts";
import type { RunRecord } from "../tinyfish/types.ts";
import { parseRunRecord } from "../tinyfish/types.ts";

export function loadRun(name: string): RunRecord {
  const url = new URL(`../../fixtures/runs/${name}.json`, import.meta.url);
  return parseRunRecord(JSON.parse(readFileSync(url, "utf8")));
}

function wordsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(wordsIn);
  return value && typeof value === "object" ? Object.values(value).flatMap(wordsIn) : [];
}

/** The same run, as if it had saved a page at each step. Serve `pageOf(run)` for that page. */
export function withSavedPages(run: RunRecord): RunRecord {
  return { ...run, steps: run.steps.map((step) => ({ ...step, html: "saved" })) };
}

export function pageOf(run: RunRecord): string {
  return wordsIn(run.result)
    .map((words) => `<p>${words}</p>`)
    .join("");
}

/**
 * A run saved before pages were captured, as if every word the agent reported was on every page.
 * A run with no step records gets one, so the judge has a screenshot to point at.
 */
export function capturedEverywhere(run: RunRecord): PageCapture[] {
  if (!run.steps.some((step) => step.screenshot)) {
    run.steps.push({
      id: "page",
      timestamp: "2026-11-01T06:30:00Z",
      status: "COMPLETED",
      action: "View the page",
      screenshot: "shot",
      duration: null,
    });
  }
  const text = comparable(wordsIn(run.result).join(" "));
  return run.steps.flatMap((step) => (step.screenshot ? [{ stepId: step.id, text }] : []));
}
