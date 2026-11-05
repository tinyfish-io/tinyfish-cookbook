import type { SiteReport } from "./types.ts";

/** The gap between the first price shown and the last total, the one number any two items share. */
export interface HiddenCost {
  amount: number;
  percent: number | null;
  /** False when the run stopped before payment, so more could still be added. */
  final: boolean;
}

export interface ComparisonRow {
  host: string;
  item: string | null;
  total: number | null;
  currency: string | null;
  destination: string | null;
  hiddenCost: HiddenCost | null;
  found: number;
  notChecked: number;
}

export interface Comparison {
  /** Why the prices beside each other are not like for like. */
  reasons: string[];
  rows: ComparisonRow[];
}

const TASK_DESTINATION = /\bto\s+([a-z][a-z ]*?)(?=\s+(?:on|for|in|by)\b|[,.?!]|$)/i;

function wantedPlace(task: string): string | null {
  return task.match(TASK_DESTINATION)?.[1]?.trim().toLowerCase() ?? null;
}

function samePlace(wanted: string, seen: string): boolean {
  return seen.toLowerCase().includes(wanted);
}

/** Size is often written both ways, "500 ml" and "500ml", so a number keeps its unit. */
function itemWords(item: string): string {
  const words = item
    .toLowerCase()
    .replace(/(\d)\s+([a-z])/g, "$1$2")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return [...new Set(words)].toSorted().join(" ");
}

/** Strict on purpose: "iPhone 15" and "iPhone 15 Pro" share words but are not the same item. */
function sameItems(reports: readonly SiteReport[]): boolean {
  const items = reports.map((report) => (report.item ? itemWords(report.item) : ""));
  return items.every((item) => item !== "" && item === items[0]);
}

export function hiddenCost({ bill, priceLabel }: SiteReport): HiddenCost | null {
  if (bill.increase === null || bill.firstPrice === null) return null;
  return {
    amount: bill.increase,
    percent: bill.firstPrice > 0 ? Math.round((bill.increase / bill.firstPrice) * 100) : null,
    final: priceLabel === "final",
  };
}

/** Sites are compared on patterns. Prices only sit beside each other, with any mismatch spelled out. */
export function compareReports(task: string, reports: readonly SiteReport[]): Comparison {
  const wanted = wantedPlace(task);
  const reasons: string[] = [];

  const rows: ComparisonRow[] = reports.map((report) => {
    const elsewhere =
      wanted !== null && report.destination !== null && !samePlace(wanted, report.destination);
    if (elsewhere) {
      reasons.push(`${report.host} priced ${report.destination}, not the place in the task.`);
    }
    if (report.bill.total === null) reasons.push(`${report.host} has no total to compare.`);

    return {
      host: report.host,
      item: report.item,
      total: report.bill.total,
      currency: report.bill.currency,
      destination: report.destination,
      hiddenCost: hiddenCost(report),
      found: report.patterns.filter((entry) => entry.status === "found").length,
      notChecked: report.patterns.filter((entry) => entry.status === "not_checked").length,
    };
  });

  const priced = rows.filter((row) => row.total !== null);
  const currencies = new Set(priced.map((row) => row.currency));
  if (currencies.size > 1) {
    reasons.push(`Prices are in different currencies: ${[...currencies].join(", ")}.`);
  }

  if (!sameItems(reports) && reports.length >= 2) {
    reasons.push("These are different items, so compare the patterns, not the prices.");
  }

  return { reasons, rows };
}
