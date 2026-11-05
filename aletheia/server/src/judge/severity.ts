import { PATTERN_IDS } from "./types.ts";
import type {
  PatternFinding,
  PatternId,
  Severity,
  ShownWhere,
  SiteReport,
  SubscriptionSummary,
  TermName,
} from "./types.ts";

export interface SeveritySummary {
  high: number;
  medium: number;
  low: number;
  /** Null when nothing was found, so a quiet report never reads as a verdict. */
  line: string | null;
}

const LEVELS: readonly Severity[] = ["high", "medium", "low"];
const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const NAMED = 2;

type Ranked = Pick<PatternFinding, "id" | "severity">;

/** Worst first, then in the taxonomy's own order. */
export function bySeverity(a: Ranked, b: Ranked): number {
  return (
    RANK[a.severity] - RANK[b.severity] || PATTERN_IDS.indexOf(a.id) - PATTERN_IDS.indexOf(b.id)
  );
}

/** What was found, worst first. */
export function rankFindings(patterns: readonly PatternFinding[]): PatternFinding[] {
  return patterns.filter(({ status }) => status === "found").toSorted(bySeverity);
}

const PHRASE: Record<Exclude<PatternId, "forced_consent">, string> = {
  drip_pricing: "fees added after the first price",
  partitioned_pricing: "a required fee shown apart from the price",
  bait_and_switch: "a higher price in the cart than on the product page",
  free_claim: "a charge for something called free",
  reference_price: "a crossed-out price",
  countdown: "a countdown or deadline",
  scarcity_message: "a low stock message",
  high_demand: "a high demand message",
  activity_message: "a message about other buyers",
  basket_sneaking: "an item added to the basket without asking",
  preselected_extra: "a paid extra switched on in advance",
  preselected_plan: "a longer plan picked in advance",
  hidden_subscription: "a recurring charge attached to the order",
  trial_needs_card: "a card asked for a free trial",
  renewal_small_print: "renewal terms away from the main offer",
  intro_price_jump: "an intro price that rises later",
  cancellation_fee: "a cancellation fee",
  hard_to_cancel: "no way to cancel online",
  cancellation_terms_missing: "no word on how to cancel",
  price_behind_signin: "a price shown only after sign-in",
  forced_action: "a step forced before going on",
  false_hierarchy: "one choice made to stand out over the other",
  confirmshaming: "shaming or guilt wording",
  trick_question: "a question worded to trip you up",
  nagging: "repeated prompts",
  disguised_ad: "an ad dressed as content",
  no_cookie_reject: "no button to reject cookies",
  preticked_consent: "a consent box ticked in advance",
};

/** The term that says where a finding was tucked away, for the patterns that rest on one. */
const PLACED_BY: Partial<Record<PatternId, TermName>> = {
  cancellation_fee: "cancellation_fee",
  intro_price_jump: "price_after_intro",
  trial_needs_card: "trial_card",
};

const TUCKED_AWAY: Partial<Record<ShownWhere, string>> = {
  fine_print: "in the fine print",
  info_icon: "behind an info icon",
  faq: "in a collapsed FAQ",
  later_page: "only on a later page",
};

const CONSENT_BUTTON =
  /\b(?:clicking|pressing|tapping|selecting|choosing)\s+(?:on\s+)?["'‘“]([^"'’”]{1,30})["'’”]/i;

type Summarised = Pick<SiteReport, "patterns"> & {
  subscription: Pick<SubscriptionSummary, "terms"> | null;
};

function phrase({ id, quote }: PatternFinding, subscription: Summarised["subscription"]): string {
  if (id === "forced_consent") {
    const button = quote?.match(CONSENT_BUTTON)?.[1]?.trim();
    return `marketing consent tied to ${button || "going on"}`;
  }
  const termName = PLACED_BY[id];
  const term = termName && subscription?.terms.find((entry) => entry.term === termName);
  const place = term ? TUCKED_AWAY[term.shownWhere] : undefined;
  return place ? `${PHRASE[id]} ${place}` : PHRASE[id];
}

function listed(phrases: string[], total: number): string {
  const rest = total - phrases.length;
  if (rest > 0) return `${phrases.join(", ")} and ${rest} more`;
  return phrases.length === 2 ? phrases.join(" and ") : phrases.join(", ");
}

/** One plain line for the top of a report: how bad, then what, worst first. */
export function severitySummary({ patterns, subscription }: Summarised): SeveritySummary {
  const found = rankFindings(patterns);
  const count = (level: Severity) => found.filter(({ severity }) => severity === level).length;
  const counts = { high: count("high"), medium: count("medium"), low: count("low") };
  if (found.length === 0) return { ...counts, line: null };

  const tally = LEVELS.filter((level) => counts[level] > 0)
    .map((level) => `${counts[level]} ${level}`)
    .join(", ");
  const named = found.slice(0, NAMED).map((entry) => phrase(entry, subscription));
  return { ...counts, line: `${tally}: ${listed(named, found.length)}` };
}
