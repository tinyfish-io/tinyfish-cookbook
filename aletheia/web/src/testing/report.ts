import { severitySummary } from "../../../server/src/judge/severity.ts";
import { PATTERN_IDS } from "../lib/types.ts";
import type { Bill, PatternFinding, SiteReport, SubscriptionSummary } from "../lib/types.ts";

const PATTERNS: readonly PatternFinding["id"][] = PATTERN_IDS;

export function finding(overrides: Partial<PatternFinding> = {}): PatternFinding {
  return {
    id: "countdown",
    label: "Countdown or deadline",
    group: "urgency",
    severity: "medium",
    status: "not_found",
    soFar: false,
    step: null,
    quote: null,
    amounts: [],
    screenshot: null,
    note: "",
    ...overrides,
  };
}

export function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    currency: "INR",
    firstPrice: null,
    firstPriceStep: null,
    firstPriceSource: null,
    itemsTotal: null,
    charges: [],
    notInTotal: [],
    includedCharges: [],
    discounts: [],
    extras: [],
    total: null,
    addsUp: null,
    unexplained: null,
    linesOverTotal: null,
    increase: null,
    multiple: null,
    ...overrides,
  };
}

export function subscription(overrides: Partial<SubscriptionSummary> = {}): SubscriptionSummary {
  return {
    plan: null,
    billingPeriod: null,
    defaultSelected: null,
    options: [],
    terms: [],
    introPrice: null,
    introPeriod: null,
    priceAfterIntro: null,
    contractTotal: null,
    renewalTotal: null,
    renewalMultiple: null,
    noCommitmentPrice: null,
    ...overrides,
  };
}

/** Every report lists every pattern, so overrides replace rows by id. Severity follows them. */
export function report(
  overrides: Partial<Omit<SiteReport, "patterns" | "severity">> & {
    patterns?: PatternFinding[];
  } = {},
): SiteReport {
  const { patterns = [], ...rest } = overrides;
  const built: Omit<SiteReport, "severity"> = {
    older: false,
    rules: 3,
    url: "https://shop.test",
    host: "shop.test",
    name: null,
    flow: "checkout",
    signedIn: false,
    runId: "run_1",
    item: null,
    origin: null,
    destination: null,
    stop: { at: "payment_page", claimed: "payment_page", note: null, reach: "payment" },
    priceLabel: "final",
    bill: bill(),
    subscription: null,
    pages: [],
    flags: [],
    missing: [],
    login: { wallAt: null, hidesFees: false, offerSignIn: false },
    ...rest,
    patterns: PATTERNS.map(
      (id) =>
        patterns.find((entry) => entry.id === id) ??
        finding({ id, label: id, status: "not_found", note: "Not seen." }),
    ),
  };
  return { ...built, severity: severitySummary(built) };
}
