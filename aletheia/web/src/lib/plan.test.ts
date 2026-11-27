import { describe, expect, it } from "vite-plus/test";

import { countryChoices, pickedSites, planNote } from "./plan.ts";
import type { PlanView } from "./types.ts";

const ixigo = { name: "ixigo", url: "https://www.ixigo.com/", host: "ixigo.com" };
const cleartrip = { name: "Cleartrip", url: "https://www.cleartrip.com/", host: "cleartrip.com" };
const goibibo = { url: "https://www.goibibo.com/", host: "goibibo.com" };

function plan(overrides: Partial<PlanView> = {}): PlanView {
  return {
    flow: "checkout",
    country: "IN",
    countryName: "India",
    proxied: true,
    category: "travel",
    source: "category",
    sites: [ixigo, cleartrip],
    question: null,
    ...overrides,
  };
}

describe("countryChoices", () => {
  it("lists each country by name in order, then worldwide", () => {
    const choices = countryChoices();

    expect(choices[0]).toEqual({ code: "AU", name: "Australia" });
    expect(choices.at(-1)).toEqual({ code: "ZZ", name: "Worldwide" });
  });
});

describe("pickedSites", () => {
  const none = { removed: [], added: [] };

  it("shows what the server picked", () => {
    expect(pickedSites([ixigo, cleartrip], none).map(({ host }) => host)).toEqual([
      "ixigo.com",
      "cleartrip.com",
    ]);
  });

  it("leaves out a removed site and keeps an added one after the picks", () => {
    const sites = pickedSites([ixigo, cleartrip], {
      ...none,
      removed: ["cleartrip.com"],
      added: [goibibo],
    });
    expect(sites.map(({ host }) => host)).toEqual(["ixigo.com", "goibibo.com"]);
  });

  it("does not list a site twice when the server picks one the visitor added", () => {
    const added = [ixigo];
    expect(pickedSites([ixigo], { ...none, added })).toHaveLength(1);
  });

  it("never lists more than one audit can take", () => {
    const added = ["a", "b", "c", "d"].map((name) => ({
      url: `https://${name}.test/`,
      host: `${name}.test`,
    }));
    expect(pickedSites([ixigo, cleartrip], { ...none, added })).toHaveLength(4);
  });
});

describe("planNote", () => {
  it("says the sites came from the task", () => {
    expect(planNote(plan({ source: "named" }))).toBe("Named in your task.");
  });

  it("names the kind of site and never the country, which the report states", () => {
    expect(planNote(plan())).toBe("The main travel sites where you are.");
  });

  it("says when a web search found the sites", () => {
    expect(planNote(plan({ source: "search", countryName: "Brazil" }))).toBe(
      "Found by a web search.",
    );
  });

  it("says when it could only offer sites that sell almost anywhere", () => {
    expect(planNote(plan({ source: "fallback" }))).toBe("Sites that sell in most countries.");
  });

  it("says nothing before there are sites", () => {
    expect(planNote(plan({ source: "none", sites: [] }))).toBeNull();
  });
});
