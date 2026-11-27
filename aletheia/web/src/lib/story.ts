import { money, plural } from "./format.ts";
import { counts, orderedPatterns, stopSummary } from "./report.ts";
import type { AuditPublic, AuditSummary, PatternFinding, SiteReport } from "./types.ts";

export function foundPatterns(report: SiteReport): PatternFinding[] {
  return orderedPatterns(report).filter(({ status }) => status === "found");
}

const grew = ({ bill }: SiteReport) =>
  bill.firstPrice !== null && bill.total !== null && (bill.increase ?? 0) > 0;

function renewal({ subscription }: SiteReport) {
  if (!subscription) return null;
  const { introPrice, priceAfterIntro } = subscription;
  if (introPrice === null || priceAfterIntro === null || priceAfterIntro <= introPrice) return null;
  return { ...subscription, introPrice, priceAfterIntro };
}

function periodSuffix(billingPeriod: string | null): string {
  if (!billingPeriod) return "";
  if (/month/i.test(billingPeriod)) return "/mo";
  return /year|annual/i.test(billingPeriod) ? "/yr" : "";
}

export interface PriceChange {
  from: number | null;
  to: number | null;
  suffix: string;
  currency: string | null;
}

/** The one price a row of the audit list may show: what was shown, then what it became. */
export function priceChange(report: SiteReport): PriceChange | null {
  const { bill } = report;
  if (grew(report)) {
    return { from: bill.firstPrice, to: bill.total, suffix: "", currency: bill.currency };
  }
  const after = renewal(report);
  if (!after) return null;
  return {
    from: after.introPrice,
    to: after.priceAfterIntro,
    suffix: periodSuffix(after.billingPeriod),
    currency: bill.currency,
  };
}

/** A price change is one finding among others, so most reports never show a bill. */
export function showsBill(report: SiteReport): boolean {
  const dripped = report.patterns.some(
    ({ id, status }) => id === "drip_pricing" && status === "found",
  );
  return dripped || grew(report);
}

function lateCharges({ bill }: SiteReport): number {
  const { firstPriceStep, charges, extras } = bill;
  const late = [...charges, ...extras].filter(({ amount, firstSeenAtStep }) => {
    if (amount <= 0) return false;
    if (firstPriceStep === null || firstSeenAtStep === null) return true;
    return firstSeenAtStep > firstPriceStep;
  });
  return late.length;
}

export function billNote(report: SiteReport): string | null {
  if (!grew(report)) return null;
  const { bill } = report;
  const late = lateCharges(report);
  const added = late === 1 ? "1 charge shows up" : `${late} charges show up`;
  const where =
    bill.firstPriceSource === "product_page"
      ? `None of ${late === 1 ? "it" : "them"} was on the product page`
      : `None of ${late === 1 ? "it" : "them"} was in the first price`;
  const times =
    bill.multiple === null
      ? ""
      : `, so the price you pay is ${bill.multiple.toFixed(1)} times the price you were shown`;
  return `${added} after the first price. ${where}${times}.`;
}

export function renewalNote(report: SiteReport): string | null {
  const after = renewal(report);
  if (!after) return null;
  const { currency } = report.bill;
  const period = after.introPeriod ?? "the offer";
  const times =
    after.renewalMultiple === null ? "" : `, ${after.renewalMultiple.toFixed(1)} times as much`;
  return `The site leads with ${money(after.introPrice, currency)} for ${period}. Then you pay ${money(after.priceAfterIntro, currency)}${times}.`;
}

function joined(words: readonly string[]): string {
  const last = words.at(-1) ?? "";
  return words.length < 2 ? last : `${words.slice(0, -1).join(", ")} and ${last}`;
}

export interface Story {
  /** Sets the wash behind the findings and the badge colour. */
  tone: "found" | "open" | "clear";
  badge: string;
  lead: string;
  /** The one word set in the serif accent. */
  accent: string;
  tail: string;
  body: string;
}

function foundStory(report: SiteReport, findings: readonly PatternFinding[]): Story {
  const seen = { tone: "found", accent: "seen", tail: "." } as const;
  const [only] = findings;
  if (only && findings.length === 1) {
    const name = only.label;
    return {
      ...seen,
      badge: `${name}, found`,
      lead: name,
      body: only.note || (only.quote ?? stopSummary(report)),
    };
  }
  const names = findings.map(({ label }, index) =>
    index === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1),
  );
  return {
    ...seen,
    badge: `${findings.length} patterns found`,
    lead: `${findings.length} dark patterns`,
    body: `${joined(names)}.`,
  };
}

/** The headline and wash of a report, all of it taken from what the run saw. */
export function story(report: SiteReport): Story {
  const findings = foundPatterns(report);
  if (findings.length > 0) return foundStory(report, findings);

  const { notChecked } = counts(report);
  if (report.login.hidesFees) {
    return {
      tone: "open",
      badge: "Fees behind a login",
      lead: "The fees are",
      accent: "behind",
      tail: "a login.",
      body: stopSummary(report),
    };
  }
  if (notChecked > 0 && report.bill.total !== null) {
    return {
      tone: "clear",
      badge: "Nothing found so far",
      lead: "Nothing",
      accent: "found",
      tail: "so far.",
      body: stopSummary(report),
    };
  }
  if (notChecked > 0) {
    return {
      tone: "open",
      badge: "Not checked",
      lead: plural(notChecked, "pattern"),
      accent: "not",
      tail: "checked.",
      body: stopSummary(report),
    };
  }
  return {
    tone: "clear",
    badge: "No patterns found",
    lead: "No dark patterns",
    accent: "found",
    tail: ".",
    body: "The agent reached every page these patterns live on and saw none of them.",
  };
}

export interface Stat {
  value: string;
  label: string;
}

export function stats(report: SiteReport, steps: number): Stat[] {
  const { found, notChecked } = counts(report);
  return [
    { value: String(found), label: "Patterns found" },
    { value: String(notChecked), label: "Not checked" },
    { value: String(steps), label: "Steps walked" },
  ];
}

const FLOW_WORDS: Record<AuditPublic["flow"], string> = {
  checkout: "a checkout",
  subscription: "a subscription sign-up",
};

/** The home page infers these silently, so the report is where they are stated. */
export function auditLine({
  flow,
  countryName,
  sites,
}: Pick<AuditPublic, "flow" | "countryName"> & {
  sites: readonly { host: string }[];
}): string {
  const where = joined(sites.map(({ host }) => host));
  return `Audited as ${FLOW_WORDS[flow]} on ${where}${countryName ? `, from ${countryName}` : ""}.`;
}

const TOTAL_LEAD: Record<SiteReport["priceLabel"], string> = {
  final: "What you pay.",
  price_before_sign_in: "Before sign-in.",
  last_seen: "Last price seen.",
  none: "What you pay.",
};

const FIRST_PRICE_SAID: Record<NonNullable<SiteReport["bill"]["firstPriceSource"]>, string> = {
  product_page: "The product page said",
  cart: "The cart first said",
  agent: "The first price was",
};

export function totalLine(report: SiteReport) {
  const { bill, priceLabel } = report;
  const lead = TOTAL_LEAD[priceLabel];
  if (!grew(report) || bill.firstPrice === null) return { lead, said: null, shown: null };
  return {
    lead,
    said: FIRST_PRICE_SAID[bill.firstPriceSource ?? "agent"],
    shown: money(bill.firstPrice, bill.currency),
  };
}

export type PillTone = "found" | "clean" | "unchecked" | "live";

export interface Pill {
  tone: PillTone;
  text: string;
}

export function billPill(report: SiteReport): Pill {
  if (report.bill.total === null) return { tone: "unchecked", text: "No total reached" };
  const late = lateCharges(report);
  if (late === 0) return { tone: "clean", text: "Nothing added so far" };
  return { tone: "found", text: `${plural(late, "charge")} added after the first price` };
}

const STATE_PILL: Record<Exclude<AuditSummary["sites"][number]["state"], "done">, Pill> = {
  queued: { tone: "unchecked", text: "Waiting" },
  running: { tone: "live", text: "Running" },
  writing_up: { tone: "live", text: "Writing up" },
  failed: { tone: "unchecked", text: "Failed" },
  cancelled: { tone: "unchecked", text: "Stopped" },
};

const NAMED_PILLS = 2;

function findingPills(report: SiteReport): Pill[] {
  const findings = foundPatterns(report);
  const named = findings
    .slice(0, NAMED_PILLS)
    .map(({ label }): Pill => ({ tone: "found", text: label }));
  const rest = findings.length - named.length;
  return rest > 0 ? [...named, { tone: "found", text: `${rest} more` }] : named;
}

/** The status of a row. `report` arrives later than the summary and may be missing. */
export function rowPills(
  {
    state,
    found,
    notChecked,
    total,
  }: Pick<AuditSummary["sites"][number], "state" | "found" | "notChecked" | "total">,
  report: SiteReport | null,
): Pill[] {
  if (state !== "done") return [STATE_PILL[state]];
  if (found > 0) return report ? findingPills(report) : [{ tone: "found", text: `${found} found` }];
  if (report?.login.hidesFees) return [{ tone: "unchecked", text: "Fees behind a login" }];
  // A run that never saw a bill has shown nothing either way, so it must not read as clean.
  if (total === null) {
    return [
      report?.stop.at === "blocked"
        ? { tone: "unchecked", text: "Blocked by the site" }
        : { tone: "unchecked", text: "Stopped early" },
    ];
  }
  if (notChecked > 0) return [{ tone: "clean", text: "Nothing found so far" }];
  return [{ tone: "clean", text: "No patterns found" }];
}
