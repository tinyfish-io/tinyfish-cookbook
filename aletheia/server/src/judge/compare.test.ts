import { describe, expect, it } from "vite-plus/test";

import { capturedEverywhere, loadRun } from "../testing/fixtures.ts";
import { compareReports } from "./compare.ts";
import { judgeRun } from "./judge.ts";
import type { PriceLabel, SiteReport } from "./types.ts";

function report(overrides: {
  host: string;
  firstPrice?: number | null;
  total?: number | null;
  currency?: string | null;
  destination?: string | null;
  item?: string | null;
  priceLabel?: PriceLabel;
}): SiteReport {
  const run = loadRun("blinkit-2");
  const base = judgeRun({
    flow: "checkout",
    url: `https://${overrides.host}/`,
    run,
    captures: capturedEverywhere(run),
  });
  const firstPrice =
    overrides.firstPrice === undefined ? base.bill.firstPrice : overrides.firstPrice;
  const total = overrides.total === undefined ? base.bill.total : overrides.total;
  return {
    ...base,
    item: overrides.item === undefined ? base.item : overrides.item,
    destination: overrides.destination ?? null,
    priceLabel: overrides.priceLabel ?? base.priceLabel,
    bill: {
      ...base.bill,
      firstPrice,
      total,
      increase: firstPrice === null || total === null ? null : total - firstPrice,
      currency: overrides.currency === undefined ? "INR" : overrides.currency,
    },
  };
}

describe("compareReports", () => {
  it("keeps the sites in the order they were audited, since prices are not the point", () => {
    const comparison = compareReports("buy one pair of headphones", [
      report({ host: "a.test", total: 90 }),
      report({ host: "b.test", total: 81 }),
    ]);

    expect(comparison.rows.map((row) => row.host)).toEqual(["a.test", "b.test"]);
    expect(comparison.rows[0]).not.toHaveProperty("rank");
  });

  it("says why mixed currencies cannot be lined up", () => {
    const comparison = compareReports("flight", [
      report({ host: "a.test", total: 9528, currency: "INR" }),
      report({ host: "b.test", total: 99.68, currency: "USD" }),
    ]);

    expect(comparison.reasons.join(" ")).toMatch(/currenc/i);
  });

  it("says when a result is for a different place than the task names", () => {
    const comparison = compareReports("One-way flight from Mumbai to Delhi on 25 Nov", [
      report({ host: "ixigo.test", total: 9973, destination: "Delhi (DEL)" }),
      report({ host: "cleartrip.test", total: 9528, destination: "Noida (DXN)" }),
    ]);

    expect(comparison.reasons.join(" ")).toMatch(/Noida/);
  });

  it("keeps a site with no total in the table and says so", () => {
    const comparison = compareReports("buy a laptop", [
      report({ host: "a.test", total: 81 }),
      report({ host: "b.test", total: null }),
    ]);

    expect(comparison.rows).toHaveLength(2);
    expect(comparison.reasons.join(" ")).toMatch(/b\.test/);
  });

  it("treats the same item as the same, however the size is written", () => {
    const comparison = compareReports("buy a laptop", [
      report({ host: "a.test", total: 90, item: "Seagate Portable Drive 500 GB" }),
      report({ host: "b.test", total: 81, item: "seagate portable drive, 500GB" }),
    ]);

    expect(comparison.reasons).toEqual([]);
  });

  it("points at the patterns when the items differ", () => {
    const comparison = compareReports("buy one item", [
      report({ host: "blinkit.test", total: 81, item: "Seagate Portable Drive 500 GB" }),
      report({ host: "croma.test", total: 199, item: "Croma USB Cable" }),
    ]);

    expect(comparison.reasons).toEqual([
      "These are different items, so compare the patterns, not the prices.",
    ]);
  });

  it("does not call a one-word difference the same item", () => {
    const comparison = compareReports("buy a phone", [
      report({ host: "a.test", total: 900, item: "iPhone 15" }),
      report({ host: "b.test", total: 800, item: "iPhone 15 Pro" }),
    ]);

    expect(comparison.reasons.join(" ")).toMatch(/different items/i);
  });

  it("does not assume items match when a site named none", () => {
    const comparison = compareReports("buy a laptop", [
      report({ host: "a.test", total: 90, item: null }),
      report({ host: "b.test", total: 81, item: "Portable Drive 500 GB" }),
    ]);

    expect(comparison.reasons.join(" ")).toMatch(/different items/i);
  });

  it("gives each site the gap between the shown price and the final price", () => {
    const comparison = compareReports("buy one item", [
      report({ host: "blinkit.test", firstPrice: 24, total: 81, item: "Drive" }),
      report({ host: "croma.test", firstPrice: 199, total: 199, item: "Cable" }),
    ]);

    expect(comparison.rows.map((row) => [row.host, row.hiddenCost])).toEqual([
      ["blinkit.test", { amount: 57, percent: 238, final: false }],
      ["croma.test", { amount: 0, percent: 0, final: false }],
    ]);
  });

  it("marks a hidden cost as final only when the run reached the payment page", () => {
    const [row] = compareReports("buy one item", [
      report({ host: "a.test", firstPrice: 100, total: 150, priceLabel: "final" }),
    ]).rows;

    expect(row?.hiddenCost).toEqual({ amount: 50, percent: 50, final: true });
  });

  it("has no hidden cost when either price is missing", () => {
    const [row] = compareReports("buy one item", [
      report({ host: "a.test", firstPrice: 100, total: null }),
    ]).rows;

    expect(row?.hiddenCost).toBeNull();
  });

  it("counts patterns found per site, since that is the real question", () => {
    const [row] = compareReports("buy a laptop", [report({ host: "a.test" })]).rows;

    expect(row?.found).toBe(1);
    expect(row?.notChecked).toBeGreaterThan(0);
  });
});
