import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import type { SearchHit } from "./planner.ts";
import { SitePlanner } from "./planner.ts";

interface Prompt {
  task: string;
  country: string;
  /** Any of these is a right first pick. Empty means the planner should ask instead. */
  hosts: string[];
  flow?: string;
}

const MINIMUM_ACCURACY = 0.95;
const MINIMUM_PROMPTS = 150;

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8")) as T;
}

const prompts = fixture<Prompt[]>("prompts.json");
const recorded = fixture<Record<string, SearchHit[]>>("search-hits.json");

const planner = new SitePlanner((query, country) =>
  Promise.resolve(recorded[`${country}|${query}`] ?? []),
);

async function missOf({ task, country, hosts, flow }: Prompt): Promise<string | null> {
  const plan = await planner.plan(task, country);
  const first = plan.sites[0]?.host;
  const rightSite =
    hosts.length === 0 ? plan.question !== null : first !== undefined && hosts.includes(first);
  const rightFlow = flow === undefined || plan.flow === flow;
  if (rightSite && rightFlow) return null;
  return `${country} "${task}" picked ${first ?? "nothing"} as ${plan.flow}`;
}

describe("the prompt corpus", () => {
  it("is large enough to mean something", () => {
    expect(prompts.length).toBeGreaterThanOrEqual(MINIMUM_PROMPTS);
  });

  it("picks the right site for at least 95 percent of what people type", async () => {
    const misses = (await Promise.all(prompts.map(missOf))).filter((miss) => miss !== null);
    const accuracy = 1 - misses.length / prompts.length;

    expect(accuracy, misses.join("\n")).toBeGreaterThanOrEqual(MINIMUM_ACCURACY);
  });

  it("never leaves anyone with no site and no question", async () => {
    for (const { task, country } of prompts) {
      const plan = await planner.plan(task, country);
      expect(plan.sites.length > 0 || plan.question !== null, task).toBe(true);
    }
  });
});
