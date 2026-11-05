import type { RunRecord } from "../tinyfish/types.ts";
import { isOrderPage } from "./bill.ts";
import type { Evidence } from "./evidence.ts";
import type { Bill, Reach, StopPoint } from "./types.ts";

const RAN_OUT = /budget|out of time|ran out|time limit|exhausted/i;
const PAYMENT_PAGE = /payment|\bpay\b/i;
const BOT_CHECK =
  /\b(bots?|captcha|security|cloudflare|akamai|perimeterx|datadome|human verification)\b/i;
const KEPT_OUT = /\b(block(ed|ing|s)?|denied|detect(ed|ion)|prevent(ed|ing|s)?)\b/i;

/** An agent that spends its whole budget on bot checks calls that incomplete, not blocked. */
function keptOutByBots(evidence: Evidence): boolean {
  const note = evidence.stopNote ?? "";
  const sawPrice =
    evidence.listedPrice !== null ||
    evidence.finalPrice !== null ||
    evidence.pages.some(({ price }) => price !== null);
  return !sawPrice && BOT_CHECK.test(note) && KEPT_OUT.test(note);
}

/** Ran out of time after finding the product and its price, short of the cart. */
export function ranShortOfTime({
  stop,
}: {
  stop: { at: StopPoint; note: string | null; reach: Reach };
}): boolean {
  return stop.at === "incomplete" && stop.reach === "offer" && RAN_OUT.test(stop.note ?? "");
}

export function resolveStop(run: RunRecord, evidence: Evidence | null): StopPoint {
  if (run.status === "FAILED") return "error";
  if (!evidence) return "incomplete";

  const stop = evidence.stopPoint;
  if (stop === "incomplete" && keptOutByBots(evidence)) return "blocked";
  if (stop !== "payment_page") return stop;

  const paymentPageSeen = evidence.pages.some((page) =>
    PAYMENT_PAGE.test(`${page.name} ${page.url ?? ""}`),
  );
  const outOfBudget = RAN_OUT.test(evidence.stopNote ?? "");
  const trusted = evidence.finalPrice !== null && paymentPageSeen && !outOfBudget;
  return trusted ? "payment_page" : "incomplete";
}

export function resolveReach(stop: StopPoint, evidence: Evidence | null, bill: Bill | null): Reach {
  if (!evidence || !bill || evidence.pages.length === 0) return "none";
  if (stop === "payment_page") return "payment";

  const pricedOrderPage = evidence.pages.some(
    (page) => isOrderPage(page) && page.price !== null && page.price >= (bill.firstPrice ?? 1),
  );
  if (pricedOrderPage || bill.charges.length > 0) return "order";
  return bill.firstPrice === null ? "pages" : "offer";
}

const REACH_ORDER: readonly Reach[] = ["none", "pages", "offer", "order", "payment"];

export function reached(reach: Reach, needed: Reach): boolean {
  return REACH_ORDER.indexOf(reach) >= REACH_ORDER.indexOf(needed);
}
