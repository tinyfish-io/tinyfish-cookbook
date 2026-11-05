import { describe, expect, it } from "vite-plus/test";

import { COVERED_COUNTRIES } from "./country.ts";
import { examplesFor } from "./examples.ts";
import { SitePlanner } from "./planner.ts";

const every = (country: string | null) => examplesFor(country, () => 0);

function allOf(country: string | null): string[] {
  const seen = new Set<string>();
  let draw = 0;
  const random = () => {
    draw = (draw * 31 + 7) % 101;
    return draw / 101;
  };
  for (let round = 0; round < 200; round += 1) {
    for (const example of examplesFor(country, random)) seen.add(example);
  }
  return [...seen];
}

describe("examplesFor", () => {
  it("shows three", () => {
    expect(every("IN")).toHaveLength(3);
    expect(every("KE")).toHaveLength(3);
    expect(every(null)).toHaveLength(3);
  });

  it("names the country's own delivery app", () => {
    expect(allOf("DE")).toContain("Order dinner on Lieferando");
    expect(allOf("IN")).toContain("Order dinner on Zomato");
  });

  it("shows only kinds that have run on the live site", () => {
    expect(allOf("IN").join(" ")).not.toMatch(/concert tickets|mobile plan|Netflix/);
  });

  it("offers the kinds that gave a useful report as a guest", () => {
    expect(allOf("IN").toSorted()).toEqual([
      "Buy a laptop on Croma",
      "Order dinner on Zomato",
      "Sign up for Adobe Creative Cloud",
    ]);
  });

  it("no longer offers Spotify, flights or hotels, in any country or worldwide", () => {
    for (const country of [...COVERED_COUNTRIES, null]) {
      expect(allOf(country).join(" ")).not.toMatch(/Spotify|flight|hotel/i);
    }
  });

  it("never offers groceries or jokes", () => {
    for (const country of COVERED_COUNTRIES) {
      expect(allOf(country).join(" ")).not.toMatch(/milk|egg|bread|grocer|gnome/i);
    }
  });

  it("shows them in a new order from one visit to the next", () => {
    const first = examplesFor("IN", () => 0.1);
    const orders = [0.9, 0.1, 0.5];
    const second = examplesFor("IN", () => orders.shift() ?? 0);

    expect(second).not.toEqual(first);
  });
});

describe.each(COVERED_COUNTRIES)("the examples for %s", (country) => {
  it("each pick a site with no search", async () => {
    const planner = new SitePlanner(() => Promise.reject(new Error("no search needed")));

    for (const example of allOf(country)) {
      const plan = await planner.plan(example, country);
      expect(plan.sites.length, example).toBeGreaterThan(0);
      expect(["named", "category"], example).toContain(plan.source);
    }
  });
});
