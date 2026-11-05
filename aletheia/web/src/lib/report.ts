import { bySeverity } from "../../../server/src/judge/severity.ts";
import { money } from "./format.ts";
import type {
  Bill,
  PatternFinding,
  Severity,
  SiteReport,
  SiteView,
  SubscriptionSummary,
} from "./types.ts";

type Term = SubscriptionSummary["terms"][number];

const PAID_LABEL: Record<SiteReport["priceLabel"], string> = {
  final: "You pay",
  price_before_sign_in: "Before sign-in",
  last_seen: "Last price seen",
  none: "You pay",
};

/** A saved report can hold the older signed `unexplained`, so a negative still reads correctly. */
export function billMismatch({ unexplained, linesOverTotal, currency }: Bill): string | null {
  const over = linesOverTotal ?? (unexplained !== null && unexplained < 0 ? -unexplained : null);
  if (over !== null) {
    return `The lines on this bill come to ${money(over, currency)} more than its total`;
  }
  return unexplained === null
    ? null
    : `${money(unexplained, currency)} of the total is on no line of the bill`;
}

/** Said once at the top of a report, so a quiet report is not read as a clean site. */
export function olderAuditNote({ older }: SiteReport): string | null {
  return older
    ? "This audit ran before page text was kept, so findings that rest on a page's exact words are not shown. Run it again for a full report."
    : null;
}

export function paidLabel(priceLabel: SiteReport["priceLabel"]): string {
  return PAID_LABEL[priceLabel];
}

export const TERM_LABEL: Record<Term["term"], string> = {
  trial: "Trial",
  renewal: "Renewal",
  price_after_intro: "Price after the offer",
  cancellation: "Cancellation",
  cancellation_fee: "Cancellation fee",
  trial_card: "Card for the trial",
};

export const SHOWN_WHERE_LABEL: Record<Term["shownWhere"], string> = {
  main_page: "On the main page",
  fine_print: "In the fine print",
  info_icon: "Behind an info icon",
  faq: "In a collapsed FAQ",
  later_page: "Only on a later page",
  not_shown: "Not shown at all",
};

const STATUS_RANK: Record<PatternFinding["status"], number> = {
  found: 0,
  not_checked: 1,
  not_found: 2,
  not_applicable: 3,
};

/** Found first, worst first, because that is the question the report answers. Clean rows last. */
export function orderedPatterns({ patterns }: SiteReport): PatternFinding[] {
  return patterns.toSorted(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || bySeverity(a, b),
  );
}

const NOT_APPLICABLE_HEADING: Record<SiteReport["flow"], string> = {
  checkout: "Doesn't apply to a one-off purchase",
  subscription: "Doesn't apply to a subscription sign-up",
};

/** Patterns that cannot occur in this flow sit apart, so the main list holds only real checks. */
export function patternGroups(report: SiteReport) {
  const rows = orderedPatterns(report);
  return {
    checked: rows.filter(({ status }) => status !== "not_applicable"),
    notApplicable: rows.filter(({ status }) => status === "not_applicable"),
    heading: NOT_APPLICABLE_HEADING[report.flow],
  };
}

const LEVEL: Record<Severity, { text: string; bars: number }> = {
  high: { text: "High", bars: 3 },
  medium: { text: "Medium", bars: 2 },
  low: { text: "Low", bars: 1 },
};

export function severityLevel(severity: Severity): { text: string; bars: number } {
  return LEVEL[severity];
}

/** The line at the top of a report, such as "1 high, 2 medium: a cancellation fee and ...". */
export function severityLine({ severity }: SiteReport): string | null {
  return severity.line;
}

export function counts({ patterns }: SiteReport) {
  const of = (status: PatternFinding["status"]) =>
    patterns.filter((entry) => entry.status === status).length;
  return {
    found: of("found"),
    notChecked: of("not_checked"),
    notFound: of("not_found"),
    notApplicable: of("not_applicable"),
  };
}

/** The one plain line that sums up a run, beside the patterns named in pills or rows. */
export function tallyLine({ found, notChecked }: { found: number; notChecked: number }): string {
  return notChecked > 0 ? `${found} found, ${notChecked} not checked` : `${found} found`;
}

export interface BillLine {
  label: string;
  amount: number;
  sign: "base" | "plus" | "minus";
  step: number | null;
  /** True when the line showed up after the first price did. */
  late: boolean;
  tag: string | null;
}

const FIRST_PRICE_LABEL: Record<NonNullable<Bill["firstPriceSource"]>, string> = {
  product_page: "Price on the product page",
  cart: "Price first seen in the cart",
  agent: "Price the agent reported",
};

export function billLines(bill: Bill): BillLine[] {
  const base = bill.itemsTotal ?? bill.firstPrice;
  if (base === null) return [];

  const after = (step: number | null) =>
    step !== null && bill.firstPriceStep !== null && step > bill.firstPriceStep;
  const line = (
    { name, amount, firstSeenAtStep }: Bill["charges"][number],
    sign: "plus" | "minus",
    tag: string | null = null,
  ): BillLine => ({
    label: name,
    amount,
    sign,
    step: firstSeenAtStep,
    late: after(firstSeenAtStep),
    tag,
  });

  const showsItems = bill.itemsTotal !== null && bill.itemsTotal !== bill.firstPrice;
  return [
    {
      label: showsItems
        ? "Items in the cart"
        : FIRST_PRICE_LABEL[bill.firstPriceSource ?? "product_page"],
      amount: base,
      sign: "base",
      step: bill.firstPriceStep,
      late: false,
      tag: null,
    },
    ...bill.charges.map((charge) => line(charge, "plus")),
    ...bill.extras.map((extra) => line(extra, "plus", "Added without asking")),
    ...bill.discounts.map((discount) => line(discount, "minus")),
  ];
}

export function stopSummary({ stop, login }: SiteReport): string {
  switch (stop.at) {
    case "payment_page":
      return "Reached the payment page and stopped there, before paying.";
    case "login_wall":
      return login.hidesFees
        ? "The site asks for sign-in before it shows its fees, so the full price is unknown."
        : "Stopped at a login. The address or payment step can still add fees.";
    case "contact_required":
      return "Stopped where the site asks for contact details.";
    case "blocked":
      return "The site blocked the agent, so this is a partial look.";
    case "error":
      return "The run hit an error before it finished.";
    case "incomplete":
      return "The run ended before it reached the payment page.";
  }
}

export function signInOffer({ login }: SiteReport): string | null {
  return login.offerSignIn ? "Sign in to check further" : null;
}

export function logoutNote(logout: SiteView["logout"]): string | null {
  if (logout === "logged_out") return "Logged out of the site. The saved sign-in is deleted.";
  if (logout === "not_confirmed") {
    return "We could not confirm the logout. The saved sign-in is deleted, but please log out of the site yourself to be sure.";
  }
  return null;
}
