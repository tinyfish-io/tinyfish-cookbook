import { describe, expect, it } from "vite-plus/test";

import { GLOBAL_CATEGORIES, NATIONAL_CATEGORIES } from "./category.ts";
import { COVERED_COUNTRIES } from "./country.ts";
import { FALLBACK_SITES } from "./sites/fallback.ts";
import { coveredCountries, sitesFor } from "./sites/index.ts";
import { MARKETS } from "./sites/markets.ts";

const MARKET_COUNT = 25;

describe("the national data", () => {
  it("covers the largest online markets", () => {
    expect(coveredCountries()).toHaveLength(MARKET_COUNT);
    for (const code of ["US", "CN", "GB", "JP", "DE", "IN", "BR", "AE"]) {
      expect(sitesFor(code), code).not.toBeNull();
    }
  });

  it("matches the list the browser uses", () => {
    expect(coveredCountries().toSorted()).toEqual([...COVERED_COUNTRIES]);
  });

  it("knows nothing of a country outside them, so Search takes over", () => {
    expect(sitesFor("KE")).toBeNull();
    expect(sitesFor(null)).toBeNull();
  });
});

describe.each(Object.entries(MARKETS))("the %s data", (_code, sites) => {
  it.each(NATIONAL_CATEGORIES)("names one to three https sites for %s", (category) => {
    const picks = sites.categories[category];
    expect(picks.length).toBeGreaterThanOrEqual(1);
    expect(picks.length).toBeLessThanOrEqual(3);
    for (const { url } of picks) expect(new URL(url).protocol).toBe("https:");
    expect(new Set(picks.map(({ url }) => new URL(url).hostname)).size).toBe(picks.length);
  });

  it("gives a place the agent can type", () => {
    expect(sites.location.length).toBeGreaterThan(3);
  });

  it("writes every brand alias in lower case", () => {
    for (const { aliases } of sites.brands) {
      for (const alias of aliases) expect(alias).toBe(alias.toLowerCase());
    }
  });
});

describe("the global data", () => {
  it.each(GLOBAL_CATEGORIES)("has sites for %s", (category) => {
    expect(FALLBACK_SITES.categories[category]?.length).toBeGreaterThan(0);
  });

  it("writes every brand alias in lower case", () => {
    for (const { aliases } of FALLBACK_SITES.brands) {
      for (const alias of aliases) expect(alias).toBe(alias.toLowerCase());
    }
  });

  it("has a country's own Amazon where one exists", () => {
    const amazon = FALLBACK_SITES.brands.find(({ name }) => name === "Amazon");
    expect(amazon?.urls?.["DE"]).toBe("https://www.amazon.de/");
    expect(amazon?.urls?.["JP"]).toBe("https://www.amazon.co.jp/");
  });
});
