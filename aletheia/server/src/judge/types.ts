export type Flow = "checkout" | "subscription";

export const PATTERN_IDS = [
  "drip_pricing",
  "partitioned_pricing",
  "bait_and_switch",
  "free_claim",
  "reference_price",
  "countdown",
  "scarcity_message",
  "high_demand",
  "activity_message",
  "basket_sneaking",
  "preselected_extra",
  "preselected_plan",
  "hidden_subscription",
  "trial_needs_card",
  "renewal_small_print",
  "intro_price_jump",
  "cancellation_fee",
  "hard_to_cancel",
  "cancellation_terms_missing",
  "price_behind_signin",
  "forced_action",
  "forced_consent",
  "false_hierarchy",
  "confirmshaming",
  "trick_question",
  "nagging",
  "disguised_ad",
  "no_cookie_reject",
  "preticked_consent",
] as const;

export type PatternId = (typeof PATTERN_IDS)[number];

export type StopPoint =
  | "payment_page"
  | "login_wall"
  | "contact_required"
  | "blocked"
  | "error"
  | "incomplete";

/** How far into the flow the run really got, from the evidence and not the agent's word. */
export type Reach = "none" | "pages" | "offer" | "order" | "payment";

export type PatternStatus = "found" | "not_found" | "not_checked" | "not_applicable";

export type Severity = "high" | "medium" | "low";

export type PatternGroup =
  | "pricing"
  | "urgency"
  | "social"
  | "sneaking"
  | "subscriptions"
  | "obstruction"
  | "forced"
  | "interface"
  | "wording"
  | "nagging"
  | "ads"
  | "privacy";

export interface Amount {
  label: string;
  amount: number;
}

export interface Screenshot {
  stepId: string;
  action: string | null;
}

export interface PatternFinding {
  id: PatternId;
  label: string;
  group: PatternGroup;
  severity: Severity;
  status: PatternStatus;
  /** True when a clean result only holds up to the last page reached. */
  soFar: boolean;
  step: number | null;
  quote: string | null;
  amounts: Amount[];
  screenshot: Screenshot | null;
  note: string;
}

export interface Charge {
  name: string;
  amount: number;
  firstSeenAtStep: number | null;
}

export type FirstPriceSource = "product_page" | "cart" | "agent";

export interface Bill {
  currency: string | null;
  firstPrice: number | null;
  firstPriceStep: number | null;
  firstPriceSource: FirstPriceSource | null;
  itemsTotal: number | null;
  charges: Charge[];
  /** Lines the site offered that the total does not contain yet, such as a delivery choice. */
  notInTotal: Charge[];
  /** Fees the site says the first price already contains, such as GST. */
  includedCharges: Charge[];
  discounts: Charge[];
  /** Pre-ticked options or added items whose amounts are proven to be in the total. */
  extras: Charge[];
  total: number | null;
  addsUp: boolean | null;
  /** What the total holds beyond its lines. Always above zero when set. */
  unexplained: number | null;
  /** What the lines hold beyond the total, a different fault with a different meaning. */
  linesOverTotal: number | null;
  increase: number | null;
  multiple: number | null;
}

export const TERM_NAMES = [
  "trial",
  "trial_card",
  "renewal",
  "price_after_intro",
  "cancellation",
  "cancellation_fee",
] as const;

export type TermName = (typeof TERM_NAMES)[number];

export type ShownWhere =
  | "main_page"
  | "fine_print"
  | "info_icon"
  | "faq"
  | "later_page"
  | "not_shown";

export interface Term {
  term: TermName;
  quote: string | null;
  shownWhere: ShownWhere;
  seenAtStep: number | null;
}

export interface PlanOption {
  label: string;
  price: number | null;
  period: string | null;
  commitment: string | null;
  feeLine: string | null;
  selectedByDefault: boolean;
  firstSeenAtStep: number | null;
}

export interface SubscriptionSummary {
  plan: string | null;
  billingPeriod: string | null;
  defaultSelected: string | null;
  options: PlanOption[];
  terms: Term[];
  introPrice: number | null;
  introPeriod: string | null;
  priceAfterIntro: number | null;
  contractTotal: number | null;
  renewalTotal: number | null;
  renewalMultiple: number | null;
  noCommitmentPrice: number | null;
}

export type FlagKind =
  | "contact_entered"
  | "payment_click"
  | "browser_changed"
  | "retried_after_block"
  | "retried_for_time";

export interface SafetyFlag {
  kind: FlagKind;
  detail: string;
  stepId: string | null;
}

export type PriceLabel = "final" | "price_before_sign_in" | "last_seen" | "none";

export interface Page {
  step: number;
  name: string;
  url: string | null;
  note: string | null;
  price: number | null;
  screenshot: Screenshot | null;
}

export interface SiteReport {
  /** The version of the rules that wrote this report. Saved reports below it are judged again. */
  rules: number;
  /** Saved before page text was kept, so quotes could not be matched to a page. */
  older: boolean;
  url: string;
  host: string;
  flow: Flow;
  signedIn: boolean;
  runId: string;
  item: string | null;
  origin: string | null;
  destination: string | null;
  stop: { at: StopPoint; claimed: string | null; note: string | null; reach: Reach };
  priceLabel: PriceLabel;
  bill: Bill;
  subscription: SubscriptionSummary | null;
  patterns: PatternFinding[];
  pages: Page[];
  flags: SafetyFlag[];
  missing: string[];
  login: { wallAt: string | null; hidesFees: boolean; offerSignIn: boolean };
}
