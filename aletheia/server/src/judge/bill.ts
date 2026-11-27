import type { Evidence, EvidenceFee, EvidencePage } from "./evidence.ts";
import type { Bill, Charge, FirstPriceSource, Flow } from "./types.ts";

const SUBTOTAL_LINE =
  /\b(items?|cart|bag|basket|order|sub)[ -]?(total|value|amount)\b|\bsubtotal\b|\bgrand total\b|^total\b|^price\b|\bmrp\b/i;
const CHARGE_WORD =
  /fee|charge|tax|gst|cess|delivery|handling|surge|packaging|convenience|platform/i;
const DISCOUNT_LINE = /discount|coupon|saving|promo|cashback/i;
const ORDER_PAGE =
  /cart|\bbag\b|basket|checkout|order|\bbill\b|verify|review|summary|your details|guest details|traveller details|passenger|reservation|book(ing)? details/i;
const NOT_AN_ORDER = /log ?in|sign[ -]?in|terms|faq|polic/i;
const CURRENCY_MARK = String.raw`(?:₹|\$|£|€|rs\.?|inr|usd|gbp|eur)`;
const STATED_TOTAL = new RegExp(
  String.raw`(?<!items?[ -])\btotal\b[^₹$£€\d]{0,12}${CURRENCY_MARK}\s*(\d[\d,]*(?:\.\d+)?)`,
  "gi",
);
const PAISE_TOLERANCE = 1;

function paise(amount: number): number {
  return Math.round(amount * 100);
}

function sumPaise(charges: readonly Charge[]): number {
  return charges.reduce((sum, charge) => sum + paise(charge.amount), 0);
}

function urlPath(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** Mentions the amount as money, such as "Rs 192" or "$12", not as any stray number. */
function mentionsMoney(text: string | null, amount: number): boolean {
  if (!text) return false;
  const digits = String(amount).replace(".", "\\.");
  const pattern = new RegExp(`${CURRENCY_MARK}\\s*${digits}(?![\\d,])`, "i");
  return pattern.test(text.replaceAll(",", ""));
}

export function isOrderPage(page: EvidencePage): boolean {
  const label = `${page.name} ${urlPath(page.url)}`;
  return ORDER_PAGE.test(label) && !NOT_AN_ORDER.test(page.name);
}

/** A number below the item price with no currency near it is a bag or result count. */
function isCount(page: EvidencePage, listed: number | null): boolean {
  if (page.price === null || listed === null || page.price >= listed) return false;
  return !mentionsMoney(page.note, page.price);
}

function realPrice(page: EvidencePage, listed: number | null): number | null {
  if (page.price === null || page.price <= 0 || isCount(page, listed)) return null;
  return page.price;
}

function isSubtotalLine(fee: EvidenceFee, listed: number | null): boolean {
  if (SUBTOTAL_LINE.test(fee.name)) return true;
  return fee.amount !== null && fee.amount === listed && !CHARGE_WORD.test(fee.name);
}

function toCharge(fee: EvidenceFee): Charge {
  return {
    name: fee.name,
    amount: Math.abs(fee.amount ?? 0),
    firstSeenAtStep: fee.firstSeenAtStep,
  };
}

interface FirstPrice {
  price: number | null;
  step: number | null;
  source: FirstPriceSource | null;
}

function findFirstPrice(evidence: Evidence): FirstPrice {
  const listed = evidence.listedPrice;
  const firstOrderIndex = evidence.pages.findIndex(isOrderPage);
  const before = firstOrderIndex === -1 ? evidence.pages : evidence.pages.slice(0, firstOrderIndex);

  for (const page of before) {
    const price = realPrice(page, listed);
    if (price !== null) return { price, step: page.step, source: "product_page" };
  }
  if (listed === null) return { price: null, step: null, source: null };

  const named = before.find((page) => mentionsMoney(page.note, listed));
  if (named) return { price: listed, step: named.step, source: "product_page" };

  const inCart = evidence.pages.some((page) => isOrderPage(page) && page.price === listed);
  return { price: listed, step: null, source: inCart ? "cart" : "agent" };
}

function lastOrderTotal(evidence: Evidence, firstPrice: number | null): number | null {
  for (const page of evidence.pages.toReversed()) {
    if (!isOrderPage(page)) continue;
    const price = realPrice(page, firstPrice);
    if (price !== null && (firstPrice === null || price >= firstPrice)) return price;
  }
  return null;
}

/**
 * What the last order page itself said the total was. The agent can leave final_price empty on a
 * one-line cart, and can add an optional fee to it by hand, so the page's words come first.
 */
function statedTotal(evidence: Evidence): number | null {
  for (const page of evidence.pages.toReversed()) {
    if (!isOrderPage(page)) continue;
    const stated = [...(page.note ?? "").matchAll(STATED_TOTAL)].at(-1)?.[1];
    if (stated) return Number(stated.replaceAll(",", ""));
  }
  return null;
}

interface TotalInputs {
  flow: Flow;
  evidence: Evidence;
  firstPrice: number | null;
  computedPaise: number | null;
  charges: readonly Charge[];
}

function chooseTotal({ flow, evidence, firstPrice, computedPaise, charges }: TotalInputs) {
  if (evidence.pages.length === 0) return null;

  const hasCharges = charges.length > 0;
  const claimed = evidence.finalPrice;
  const claimedIsPrice = claimed !== null && claimed > 0 && claimed >= (firstPrice ?? 0);
  const pageTotal = lastOrderTotal(evidence, firstPrice);

  if (flow === "subscription") {
    const onOrderPage = evidence.pages.some(isOrderPage);
    return claimedIsPrice && evidence.billItemised && onOrderPage ? claimed : null;
  }
  const stated = statedTotal(evidence);
  if (stated !== null && stated >= (firstPrice ?? 0)) {
    const summedByHand =
      claimed !== null && offeredOnly(charges, paise(claimed) - paise(stated)).length > 0;
    if (claimed === null || summedByHand) return stated;
  }
  if (claimedIsPrice && (hasCharges || claimed === pageTotal)) return claimed;
  if (
    hasCharges &&
    pageTotal !== null &&
    computedPaise !== null &&
    Math.abs(paise(pageTotal) - computedPaise) <= PAISE_TOLERANCE
  ) {
    return pageTotal;
  }
  return null;
}

/** Extras count only if the bill proves they are in the total: a named line or the exact gap. */
function provenExtras(evidence: Evidence, charges: readonly Charge[], gapPaise: number): Charge[] {
  const candidates = [
    ...evidence.preTicked.map((option) => ({
      name: option.label,
      cost: option.cost,
      step: option.seenAtStep,
    })),
    ...evidence.added.map((item) => ({ name: item.name, cost: item.cost, step: item.seenAtStep })),
  ];
  const named = charges.map((charge) => charge.name.toLowerCase());

  return candidates.flatMap((candidate) => {
    if (candidate.cost === null || candidate.cost <= 0) return [];
    if (named.some((name) => name.includes(candidate.name.toLowerCase()))) return [];
    if (paise(candidate.cost) !== gapPaise) return [];
    return [{ name: candidate.name, amount: candidate.cost, firstSeenAtStep: candidate.step }];
  });
}

/** A total below its own lines means a line was only offered, such as a delivery choice. */
function offeredOnly(charges: readonly Charge[], overPaise: number): Charge[] {
  if (overPaise <= PAISE_TOLERANCE) return [];
  if (sumPaise(charges) === overPaise) return [...charges];
  const line = charges.find((charge) => paise(charge.amount) === overPaise);
  return line ? [line] : [];
}

export function buildBill(flow: Flow, evidence: Evidence): Bill {
  const first = findFirstPrice(evidence);
  const listed = first.price;

  const priced = evidence.fees.filter((fee) => fee.amount !== null);
  const itemLine = priced.find((fee) => isSubtotalLine(fee, listed));
  const lines = priced.filter((fee) => !isSubtotalLine(fee, listed));
  const included = lines.filter((fee) => fee.includedInFirstPrice === true);
  const added = lines.filter((fee) => fee.includedInFirstPrice !== true);
  const discounts = added.filter((fee) => DISCOUNT_LINE.test(fee.name) || (fee.amount ?? 0) < 0);
  const charges = added.filter((fee) => !discounts.includes(fee));

  const itemsTotal = itemLine?.amount ?? null;
  const base = itemsTotal ?? listed;
  const chargeList = charges.map(toCharge);
  const discountList = discounts.map(toCharge);
  const computedPaise =
    base === null ? null : paise(base) + sumPaise(chargeList) - sumPaise(discountList);

  const total = chooseTotal({
    flow,
    evidence,
    firstPrice: listed,
    computedPaise,
    charges: chargeList,
  });

  const gapPaise = total === null || computedPaise === null ? 0 : paise(total) - computedPaise;
  const notInTotal = offeredOnly(chargeList, -gapPaise);
  const billedCharges = chargeList.filter((charge) => !notInTotal.includes(charge));
  const extras = gapPaise > 0 ? provenExtras(evidence, chargeList, gapPaise) : [];
  const unexplainedPaise = gapPaise - sumPaise(extras) + sumPaise(notInTotal);
  const addsUp =
    total === null || computedPaise === null ? null : Math.abs(unexplainedPaise) <= PAISE_TOLERANCE;

  const hasPrice = listed !== null || evidence.pages.some((page) => page.price !== null);

  return {
    currency: hasPrice ? evidence.currency : null,
    firstPrice: listed,
    firstPriceStep: first.step,
    firstPriceSource: first.source,
    itemsTotal,
    charges: billedCharges,
    notInTotal,
    includedCharges: included.map(toCharge),
    discounts: discountList,
    extras,
    total,
    addsUp,
    unexplained: addsUp === false && unexplainedPaise > 0 ? unexplainedPaise / 100 : null,
    linesOverTotal: addsUp === false && unexplainedPaise < 0 ? -unexplainedPaise / 100 : null,
    increase: total !== null && listed !== null ? (paise(total) - paise(listed)) / 100 : null,
    multiple: total !== null && listed !== null && listed > 0 ? total / listed : null,
  };
}
