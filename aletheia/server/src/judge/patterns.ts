import type { Evidence, PatternCheck } from "./evidence.ts";
import type { PageCapture } from "./pageText.ts";
import { SHAMING_DECLINE } from "./pageSignals.ts";
import { reached } from "./stop.ts";
import type {
  Amount,
  Bill,
  Flow,
  PatternGroup,
  PatternId,
  PatternStatus,
  Reach,
  Severity,
  StopPoint,
  TermName,
} from "./types.ts";

export interface PatternContext {
  flow: Flow;
  evidence: Evidence | null;
  bill: Bill | null;
  stop: StopPoint;
  reach: Reach;
  captures: readonly PageCapture[];
}

/** A context with evidence in hand: rules never run on a run that returned nothing. */
interface JudgedContext extends PatternContext {
  evidence: Evidence;
  bill: Bill;
}

export interface Draft {
  status: PatternStatus;
  /** The words shown to the reader. */
  quote: string | null;
  /** Words that must be on one captured page before this can be shown. Any one of them will do. */
  anchors: string[];
  /** Words that must share that page. */
  alongside: string[];
  step: number | null;
  amounts: Amount[];
  note: string;
}

interface Definition {
  id: PatternId;
  label: string;
  group: PatternGroup;
  severity: Severity;
  /** The furthest page this pattern lives on. Before it, the answer is "not checked". */
  needs: Reach;
  /** The result field the agent fills for this pattern. A run without it never looked. */
  signal: string;
  /** The flows this pattern can occur in, when it cannot occur in both. */
  flows?: readonly Flow[];
  rule: (context: JudgedContext) => Draft | null;
}

/** Stands for the agent's newer signals, which arrived together. */
const CURRENT_AGENT = "price_anchors";

const COUNTDOWN =
  /countdown|\boffers? ends?\b|\bsale ends?\b|\bends? (in|today|tonight|soon|at|on)\b|\bexpires? (in|today|tonight|soon)\b|limited[- ](time|period)|last chance|today only|\b\d{1,2}:\d{2}(:\d{2})?\b/i;
const SCARCITY =
  /\bonly \d+\b|\b\d+\s+(left|remaining)\b|\b\d+\s+seats?\b|\blast \d+\b|almost gone|low stock|few left|limited stock|running out/i;
const HIGH_DEMAND =
  /selling fast|filling fast|selling out|in (high )?demand|going fast|sell(s|ing)? out soon|booking fast/i;
const ACTIVITY =
  /\b\d[\d,]*\+?\s+(people|others|customers|users|travell?ers|guests|shoppers|buyers)\b|\b(booked|bought|sold|viewed|purchased) \d+|\b(just|recently) (booked|bought|purchased|sold)\b/i;
const GUILT_NUDGE =
  /malnutrition|brighten their day|help us|help (them|feed)|feed (a|the)|hungry|don'?t let|you'?ll regret/i;
const ACCOUNT_REQUIREMENT =
  /account|sign[ -]?(in|up)|log ?in|e-?mail|mobile number|phone|credential|authenticat/i;
// Terms of use are the price of any sale, so agreeing to them forces nothing extra.
const PLAIN_TERMS = /\b(t&c|terms|conditions|privacy|policy)\b/i;
const MARKETING_CONSENT =
  /market|promot|personali[sz]ed|newsletter|keep me informed|special offers|\boffers\b|third part/i;
const FEE_WORD = /\bfees?\b|\bcharges?\b|penalt|remaining|lump sum|early terminat/i;
const NO_FEE =
  /\bno (cancell?ation )?(fee|charge|penalt)|without (any )?(fee|charge|penalt)|free of charge|not (mentioned|shown)/i;
const SPLIT_PRICE = /\+|\bplus\b|\bexcl|\bnot including\b|\bextra\b|\badditional\b/i;
const FEE_NAME = /\b(fee|fees|charge|charges|surcharge)\b/i;
const TAX_LINE = /\b(tax|taxes|vat|gst|cgst|sgst|igst|hst|duty|duties)\b/i;
const FREE_WORD = /\bfree\b/i;
const FREE_THRESHOLD = /\b(above|over|orders? of|min(imum)?|spend|or more)\b/i;
const NEGATIVE_FORM = /\b(not|don'?t|never|unless|un-?(check|tick)|opt(ing)? out)\b/i;
const RECURRING_ITEM = /member|subscri|renew|recurr|monthly|annual|trial/i;
const NEEDED_ANYWAY = /delivery|shipping/i;
const INSURED_DELIVERY = /insur|protect|assur/i;
const COOKIE_PROMPT = /cookie/i;
// A bare "Got it" only closes a notice, so there is no choice to refuse.
const ACCEPT_WORD = /accept|agree|allow|consent/i;
const CARD_WORD = /\bcard\b|payment (method|details|information)|billing (details|information)/i;
const FREE_TRIAL = /\bfree\b|\btrial\b/i;
const RENEWAL_WORD =
  /renew|auto|recurr|(until|unless) (you )?cancel|each (month|year)|every (month|year)|billed/i;
const OFFLINE_CANCEL =
  /\b(call(ing)?|phon(e|ing)|telephone|e-?mail(ing)?|writ(e|ing) to|in writing|written notice|by post|contact (us|customer|support)|chat with|visit (a|the|your|our) (store|branch|office))\b/i;
const ONLINE_CANCEL = /\bonline\b|in your account|account settings|self[- ]service|\bone click\b/i;

// Captured text has no spaces, so these read it as it is stored.
const RENEWAL_ON_PAGE =
  /renew|recurring|autopay|auto-pay|automaticallycharged|untilyoucancel|billedmonthly|billedannually/;
const CANCEL_ON_PAGE = /cancel/;

const SMALL_PRINT: ReadonlySet<string> = new Set(["fine_print", "info_icon", "faq", "later_page"]);

export const UNCONFIRMED = "Could not be confirmed on this run.";
export const OLDER_AUDIT = "This older audit kept no page text, so this could not be matched.";
const NOTHING_SEEN = "Nothing of this kind was seen on the pages reached.";

function draft(status: PatternStatus, note: string, extra: Partial<Draft> = {}): Draft {
  return {
    status,
    quote: null,
    anchors: [],
    alongside: [],
    step: null,
    amounts: [],
    note,
    ...extra,
  };
}

/** A finding made of words on the page, which are what the reader sees. */
function seen(quote: string, step: number | null, note: string, extra: Partial<Draft> = {}): Draft {
  return draft("found", note, { quote, anchors: [quote], step, ...extra });
}

const notConfirmed = () => draft("not_checked", UNCONFIRMED);

function agentCheck(
  { checks }: Evidence,
  id: PatternId,
): (PatternCheck & { quote: string }) | null {
  const check = checks[id];
  return check?.status === "found" && check.quote ? { ...check, quote: check.quote } : null;
}

function agentQuote(
  evidence: Evidence,
  id: PatternId,
  note: string,
  wanted?: RegExp,
): Draft | null {
  const check = agentCheck(evidence, id);
  if (!check || (wanted && !wanted.test(check.quote))) return null;
  return seen(check.quote, check.seenAtStep, note);
}

/** Reads only the bill, so a saved report can answer it after its run is gone. */
export function dripPricingFromBill(bill: Bill, stop: StopPoint, lastStep: number | null): Draft {
  if (bill.total === null || bill.firstPrice === null) {
    return draft(
      "not_checked",
      stop === "login_wall"
        ? "The site shows no bill before sign-in, so its fees are unknown."
        : "No bill was reached, so its fees are unknown.",
    );
  }
  if (Math.round(bill.total * 100) <= Math.round(bill.firstPrice * 100)) {
    return draft("not_found", "The total matches the first price shown.");
  }
  if (!bill.addsUp) return notConfirmed();

  const lines = [...bill.charges, ...bill.extras].filter((charge) => charge.amount > 0);
  const fees = lines.filter((charge) => !TAX_LINE.test(charge.name));
  if (fees.length === 0) return draft("not_found", "Only taxes were added to the first price.");

  const firstSeen = fees.map((charge) => charge.firstSeenAtStep).filter((step) => step !== null);
  return draft("found", "Fees were added after the first price.", {
    anchors: fees.map(({ name }) => name),
    amounts: lines.map(({ name, amount }) => ({ label: name, amount })),
    step: firstSeen.length > 0 ? Math.min(...firstSeen) : lastStep,
  });
}

function dripPricing({ bill, evidence, stop }: JudgedContext): Draft {
  return dripPricingFromBill(bill, stop, evidence.pages.at(-1)?.step ?? null);
}

function partitionedPricing({ evidence }: JudgedContext): Draft | null {
  const check = agentCheck(evidence, "partitioned_pricing");
  if (!check || !SPLIT_PRICE.test(check.quote) || !FEE_NAME.test(check.quote)) return null;
  return seen(
    check.quote,
    check.seenAtStep,
    "A required fee is shown beside the price, not in it.",
  );
}

function baitAndSwitch({ bill, evidence }: JudgedContext): Draft | null {
  const { itemsTotal, firstPrice, firstPriceSource, firstPriceStep } = bill;
  const dearerInCart =
    itemsTotal !== null &&
    firstPrice !== null &&
    firstPriceSource === "product_page" &&
    Math.round(itemsTotal * 100) > Math.round(firstPrice * 100);

  if (dearerInCart) {
    if (evidence.cartItemCount === null) return notConfirmed();
    if (evidence.cartItemCount === 1 && evidence.itemName) {
      return draft("found", "The same item costs more in the cart than on its page.", {
        anchors: [evidence.itemName],
        step: firstPriceStep,
        amounts: [
          { label: "Price on the product page", amount: firstPrice },
          { label: "Item total in the cart", amount: itemsTotal },
        ],
      });
    }
  }
  return agentQuote(evidence, "bait_and_switch", "The offer changed partway through the flow.");
}

function freeClaim({ bill, evidence }: JudgedContext): Draft | null {
  const check = agentCheck(evidence, "free_claim");
  if (!check || !FREE_WORD.test(check.quote) || FREE_THRESHOLD.test(check.quote)) return null;

  const words = check.quote
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3 && word !== "free");
  const line = bill.charges.find(
    ({ name, amount }) =>
      amount > 0 && words.some((word) => name.toLowerCase().split(/\W+/).includes(word)),
  );
  if (!line || !bill.addsUp) return null;
  return seen(check.quote, check.seenAtStep, "The page says free, and the bill charges for it.", {
    amounts: [{ label: line.name, amount: line.amount }],
  });
}

function referencePrice({ evidence }: JudgedContext): Draft | null {
  const anchor = evidence.priceAnchors.find(
    ({ price, referencePrice: reference }) => price > 0 && reference > price,
  );
  if (!anchor) return null;
  return seen(
    anchor.quote,
    anchor.seenAtStep,
    "A higher price is crossed out beside the price. The page does not show when it applied.",
    {
      amounts: [
        { label: "Crossed-out price", amount: anchor.referencePrice },
        { label: "Price shown", amount: anchor.price },
      ],
    },
  );
}

function pressureRule(id: PatternId, wording: RegExp, note: string) {
  return ({ evidence }: JudgedContext): Draft | null => {
    const message = evidence.pressure.find(
      ({ text, kind }) => kind === id || (!kind && wording.test(text)),
    );
    return message ? seen(message.text, message.seenAtStep, note) : null;
  };
}

function basketSneaking({ bill }: JudgedContext): Draft | null {
  const { extras, addsUp } = bill;
  if (extras.length === 0) return null;
  if (!addsUp) return notConfirmed();
  return draft("found", "Added without asking, and its amount is in the total.", {
    anchors: extras.map(({ name }) => name),
    amounts: extras.map(({ name, amount }) => ({ label: name, amount })),
    step: extras[0]?.firstSeenAtStep ?? null,
  });
}

function preselectedExtra({ evidence, bill }: JudgedContext): Draft | null {
  const inBasket = bill.extras.map(({ name }) => name);
  const option = evidence.preTicked.find(
    ({ label, cost }) =>
      cost !== null &&
      cost > 0 &&
      !inBasket.includes(label) &&
      (!NEEDED_ANYWAY.test(label) || INSURED_DELIVERY.test(label)),
  );
  if (!option || option.cost === null) return null;
  return seen(option.label, option.seenAtStep, "A paid extra was already switched on.", {
    amounts: [{ label: option.label, amount: option.cost }],
  });
}

export function isNoCommitment(commitment: string | null): boolean {
  if (commitment === null) return true;
  return /^(none|no (commitment|contract|term)|n\/a)|cancel any ?time/i.test(commitment.trim());
}

function preselectedPlan({ evidence }: JudgedContext): Draft | null {
  const chosen = evidence.planOptions.find((option) => option.selectedByDefault);
  if (!chosen?.commitment || isNoCommitment(chosen.commitment)) return null;
  const free = evidence.planOptions.find(
    (option) => option !== chosen && isNoCommitment(option.commitment),
  );
  if (!free) return null;
  const later = (free.firstSeenAtStep ?? 0) > (chosen.firstSeenAtStep ?? 0);
  return seen(
    chosen.label,
    chosen.firstSeenAtStep,
    later
      ? `The plan with a commitment is the default. The plan with none appears only on step ${free.firstSeenAtStep}.`
      : "The plan with a commitment is selected by default, though a plan with none exists.",
    { alongside: later ? [] : [free.label] },
  );
}

function namesOfPlan({ planName, planOptions }: Evidence): string[] {
  return [planName, ...planOptions.map(({ label }) => label)].filter((name) => name !== null);
}

/** Saying a word is absent needs the whole walk, so only the payment page can show it. */
function absentFromEveryPage(
  { stop, captures, evidence }: JudgedContext,
  term: TermName,
  wording: RegExp,
): boolean {
  const reported = evidence.terms.find((entry) => entry.term === term);
  return (
    stop === "payment_page" &&
    captures.length > 0 &&
    (!reported || reported.shownWhere === "not_shown") &&
    !captures.some(({ text }) => wording.test(text))
  );
}

function hiddenSubscription(context: JudgedContext): Draft | null {
  const { evidence } = context;
  if (absentFromEveryPage(context, "renewal", RENEWAL_ON_PAGE)) {
    return draft("found", "Up to the payment page, nothing said this plan renews.", {
      anchors: namesOfPlan(evidence),
      step: evidence.pages.at(-1)?.step ?? null,
    });
  }
  return agentQuote(
    evidence,
    "hidden_subscription",
    "A recurring charge was attached to this order.",
    RECURRING_ITEM,
  );
}

function termQuote(evidence: Evidence, name: TermName) {
  const term = evidence.terms.find(
    (entry) => entry.term === name && entry.quote && entry.shownWhere !== "not_shown",
  );
  return term?.quote ? { ...term, quote: term.quote } : null;
}

function trialNeedsCard({ evidence }: JudgedContext): Draft | null {
  const term = termQuote(evidence, "trial_card");
  const trial = termQuote(evidence, "trial");
  if (!term || !CARD_WORD.test(term.quote) || !trial || !FREE_TRIAL.test(trial.quote)) return null;
  return seen(term.quote, term.seenAtStep, "The free trial asks for payment details up front.");
}

function renewalSmallPrint({ evidence }: JudgedContext): Draft | null {
  const term = termQuote(evidence, "renewal");
  if (!term || !SMALL_PRINT.has(term.shownWhere) || !RENEWAL_WORD.test(term.quote)) return null;
  return seen(term.quote, term.seenAtStep, "The renewal is stated only away from the main offer.");
}

function introPriceJump({ evidence }: JudgedContext): Draft | null {
  const { introPrice, priceAfterIntro } = evidence;
  if (introPrice === null || priceAfterIntro === null || priceAfterIntro <= introPrice) return null;
  const term = termQuote(evidence, "price_after_intro");
  if (!term || term.shownWhere === "main_page") return null;
  // A later price already crossed out beside the offer is in plain view.
  const inView = evidence.priceAnchors.some(
    ({ price, referencePrice: reference }) => price === introPrice && reference === priceAfterIntro,
  );
  if (inView) return null;
  return seen(
    term.quote,
    term.seenAtStep,
    "The higher price after the offer is out of plain view.",
    {
      amounts: [
        { label: "First price", amount: introPrice },
        { label: "Price after the offer", amount: priceAfterIntro },
      ],
    },
  );
}

function cancellationFee({ flow, evidence, bill }: JudgedContext): Draft | null {
  if (flow !== "subscription") return null;
  const fee = evidence.terms.find(
    (term) =>
      term.term === "cancellation_fee" &&
      term.shownWhere !== "not_shown" &&
      FEE_WORD.test(term.quote ?? "") &&
      !NO_FEE.test(term.quote ?? ""),
  );
  if (!fee?.quote) return null;
  const priceStep = bill.firstPriceStep ?? evidence.pages[0]?.step ?? null;
  const later = fee.seenAtStep !== null && priceStep !== null && fee.seenAtStep > priceStep;
  return seen(
    fee.quote,
    fee.seenAtStep,
    later
      ? `A cancellation fee is first shown on step ${fee.seenAtStep}, after the price on step ${priceStep}.`
      : "A fee for leaving early.",
  );
}

function hardToCancel({ evidence }: JudgedContext): Draft | null {
  const term = termQuote(evidence, "cancellation");
  if (!term || !OFFLINE_CANCEL.test(term.quote) || ONLINE_CANCEL.test(term.quote)) return null;
  return seen(term.quote, term.seenAtStep, "Signing up is online, but cancelling is not.");
}

function cancellationTermsMissing(context: JudgedContext): Draft | null {
  if (!absentFromEveryPage(context, "cancellation", CANCEL_ON_PAGE)) return null;
  return draft("found", "Up to the payment page, nothing said how to cancel.", {
    anchors: namesOfPlan(context.evidence),
    step: context.evidence.pages.at(-1)?.step ?? null,
  });
}

function priceBehindSignIn({ flow, stop, bill, evidence }: JudgedContext): Draft | null {
  if (flow !== "checkout" || bill.total !== null) return null;
  if (stop !== "login_wall" && stop !== "contact_required") return null;
  const note =
    "The site asks for an account or contact details before showing what the order costs.";
  return evidence.loginPrompt
    ? seen(evidence.loginPrompt, evidence.pages.at(-1)?.step ?? null, note)
    : agentQuote(evidence, "price_behind_signin", note);
}

function forcedAction({ evidence }: JudgedContext): Draft | null {
  const check = agentCheck(evidence, "forced_action");
  if (!check || ACCOUNT_REQUIREMENT.test(check.quote) || PLAIN_TERMS.test(check.quote)) return null;
  return seen(check.quote, check.seenAtStep, "This must be done before the flow goes on.");
}

function forcedConsent({ evidence }: JudgedContext): Draft | null {
  const consent = evidence.consent.find(
    ({ text, canDeclineSeparately }) =>
      canDeclineSeparately === false && MARKETING_CONSENT.test(text),
  );
  if (!consent) return null;
  return seen(
    consent.text,
    consent.seenAtStep,
    "Going on means agreeing to this, and it cannot be declined on its own.",
  );
}

function falseHierarchy({ evidence }: JudgedContext): Draft | null {
  const [pair] = evidence.emphasisPairs;
  if (!pair) return null;
  return seen(
    pair.prominent,
    pair.seenAtStep,
    `This choice stands out, while "${pair.muted}" is much fainter.`,
    { alongside: [pair.muted] },
  );
}

function confirmshaming({ evidence }: JudgedContext): Draft | null {
  const decline = evidence.declineWording.find(({ text }) => SHAMING_DECLINE.test(text));
  if (decline) {
    const step = decline.seenAtStep ?? evidence.checks.confirmshaming?.seenAtStep ?? null;
    return seen(decline.text, step, "The button to decline uses shaming wording.");
  }
  const nudge = evidence.pressure.find(({ text }) => GUILT_NUDGE.test(text));
  return nudge
    ? seen(nudge.text, nudge.seenAtStep, "A guilt nudge beside an optional extra.")
    : null;
}

function trickQuestion({ evidence }: JudgedContext): Draft | null {
  return agentQuote(
    evidence,
    "trick_question",
    "Worded so that it is easy to agree by mistake.",
    NEGATIVE_FORM,
  );
}

function nagging({ evidence }: JudgedContext): Draft | null {
  const prompt = evidence.repeatedPrompts.find(
    ({ text, steps }) => new Set(steps).size >= 2 && !COOKIE_PROMPT.test(text),
  );
  if (!prompt) return null;
  return seen(
    prompt.text,
    prompt.steps[1] ?? null,
    `The same prompt came back on ${new Set(prompt.steps).size} steps.`,
  );
}

function disguisedAd({ evidence }: JudgedContext): Draft | null {
  return agentQuote(evidence, "disguised_ad", "An ad made to look like part of the page.");
}

function noCookieReject({ evidence }: JudgedContext): Draft | null {
  const banner = evidence.cookieBanners.find(
    ({ accept, reject }) => accept && !reject && ACCEPT_WORD.test(accept),
  );
  if (!banner?.accept) return null;
  return seen(
    banner.accept,
    banner.seenAtStep,
    "The cookie banner offered no reject button on its first screen.",
  );
}

function pretickedConsent({ evidence }: JudgedContext): Draft | null {
  const box = evidence.preTicked.find(({ label, cost }) => !cost && MARKETING_CONSENT.test(label));
  return box ? seen(box.label, box.seenAtStep, "This box was already ticked.") : null;
}

export const PATTERNS: readonly Definition[] = [
  {
    id: "drip_pricing",
    label: "Drip pricing",
    group: "pricing",
    severity: "high",
    needs: "order",
    signal: "fees",
    rule: dripPricing,
  },
  {
    id: "partitioned_pricing",
    label: "Partitioned pricing",
    group: "pricing",
    severity: "medium",
    needs: "offer",
    signal: CURRENT_AGENT,
    rule: partitionedPricing,
  },
  {
    id: "bait_and_switch",
    label: "Bait and switch",
    group: "pricing",
    severity: "high",
    needs: "order",
    signal: "fees",
    rule: baitAndSwitch,
  },
  {
    id: "free_claim",
    label: "Free claim with a charge",
    group: "pricing",
    severity: "high",
    needs: "order",
    signal: CURRENT_AGENT,
    rule: freeClaim,
  },
  {
    id: "reference_price",
    label: "Crossed-out price",
    group: "pricing",
    severity: "low",
    needs: "offer",
    signal: CURRENT_AGENT,
    rule: referencePrice,
  },
  {
    id: "countdown",
    label: "Countdown or deadline",
    group: "urgency",
    severity: "medium",
    needs: "pages",
    signal: "pressure_messages",
    rule: pressureRule("countdown", COUNTDOWN, "A timer or deadline on the page."),
  },
  {
    id: "scarcity_message",
    label: "Scarcity message",
    group: "urgency",
    severity: "medium",
    needs: "pages",
    signal: "pressure_messages",
    rule: pressureRule("scarcity_message", SCARCITY, "The page says few are left."),
  },
  {
    id: "high_demand",
    label: "High demand message",
    group: "urgency",
    severity: "medium",
    needs: "pages",
    signal: "pressure_messages",
    rule: pressureRule("high_demand", HIGH_DEMAND, "The page says this is selling fast."),
  },
  {
    id: "activity_message",
    label: "Activity message",
    group: "social",
    severity: "low",
    needs: "pages",
    signal: "pressure_messages",
    rule: pressureRule(
      "activity_message",
      ACTIVITY,
      "The page reports what other people are doing.",
    ),
  },
  {
    id: "basket_sneaking",
    label: "Sneak into basket",
    group: "sneaking",
    severity: "high",
    needs: "order",
    signal: "added_without_asking",
    rule: basketSneaking,
  },
  {
    id: "preselected_extra",
    label: "Pre-selected extra",
    group: "sneaking",
    severity: "high",
    needs: "order",
    signal: "pre_ticked_options",
    rule: preselectedExtra,
  },
  {
    id: "preselected_plan",
    flows: ["subscription"],
    label: "Longer plan pre-selected",
    group: "sneaking",
    severity: "medium",
    needs: "offer",
    signal: "plan_options",
    rule: preselectedPlan,
  },
  {
    id: "hidden_subscription",
    label: "Hidden subscription",
    group: "sneaking",
    severity: "high",
    needs: "payment",
    signal: "pattern_checks",
    rule: hiddenSubscription,
  },
  {
    id: "trial_needs_card",
    flows: ["subscription"],
    label: "Card needed for a free trial",
    group: "subscriptions",
    severity: "medium",
    needs: "offer",
    signal: CURRENT_AGENT,
    rule: trialNeedsCard,
  },
  {
    id: "renewal_small_print",
    flows: ["subscription"],
    label: "Renewal in the small print",
    group: "subscriptions",
    severity: "medium",
    needs: "offer",
    signal: "terms",
    rule: renewalSmallPrint,
  },
  {
    id: "intro_price_jump",
    flows: ["subscription"],
    label: "Intro price that jumps",
    group: "subscriptions",
    severity: "medium",
    needs: "offer",
    signal: "terms",
    rule: introPriceJump,
  },
  {
    id: "cancellation_fee",
    flows: ["subscription"],
    label: "Cancellation fee",
    group: "subscriptions",
    severity: "high",
    needs: "offer",
    signal: "terms",
    rule: cancellationFee,
  },
  {
    id: "hard_to_cancel",
    flows: ["subscription"],
    label: "Hard to cancel",
    group: "subscriptions",
    severity: "high",
    needs: "offer",
    signal: "terms",
    rule: hardToCancel,
  },
  {
    id: "cancellation_terms_missing",
    flows: ["subscription"],
    label: "No cancellation terms",
    group: "subscriptions",
    severity: "medium",
    needs: "payment",
    signal: "terms",
    rule: cancellationTermsMissing,
  },
  {
    id: "price_behind_signin",
    flows: ["checkout"],
    label: "Price behind sign-in",
    group: "obstruction",
    severity: "medium",
    needs: "pages",
    signal: CURRENT_AGENT,
    rule: priceBehindSignIn,
  },
  {
    id: "forced_action",
    label: "Forced action",
    group: "forced",
    severity: "high",
    needs: "pages",
    signal: "pattern_checks",
    rule: forcedAction,
  },
  {
    id: "forced_consent",
    label: "Forced marketing consent",
    group: "forced",
    severity: "medium",
    needs: "pages",
    signal: "consent_text",
    rule: forcedConsent,
  },
  {
    id: "false_hierarchy",
    label: "False hierarchy",
    group: "interface",
    severity: "medium",
    needs: "pages",
    signal: CURRENT_AGENT,
    rule: falseHierarchy,
  },
  {
    id: "confirmshaming",
    label: "Confirmshaming",
    group: "wording",
    severity: "medium",
    needs: "order",
    signal: "decline_wording",
    rule: confirmshaming,
  },
  {
    id: "trick_question",
    label: "Trick question",
    group: "wording",
    severity: "medium",
    needs: "pages",
    signal: "pattern_checks",
    rule: trickQuestion,
  },
  {
    id: "nagging",
    label: "Nagging",
    group: "nagging",
    severity: "medium",
    needs: "pages",
    signal: CURRENT_AGENT,
    rule: nagging,
  },
  {
    id: "disguised_ad",
    label: "Disguised ad",
    group: "ads",
    severity: "medium",
    needs: "pages",
    signal: "pattern_checks",
    rule: disguisedAd,
  },
  {
    id: "no_cookie_reject",
    label: "No cookie reject button",
    group: "privacy",
    severity: "medium",
    needs: "pages",
    signal: CURRENT_AGENT,
    rule: noCookieReject,
  },
  {
    id: "preticked_consent",
    label: "Pre-ticked consent",
    group: "privacy",
    severity: "medium",
    needs: "pages",
    signal: "pre_ticked_options",
    rule: pretickedConsent,
  },
];

function unreachedNote(context: PatternContext, needs: Reach): string {
  if (context.reach === "none") return "The run returned no pages to judge.";
  if (needs === "payment") {
    return context.stop === "login_wall"
      ? "Sign-in stopped the run before the payment page."
      : "The payment page was not reached.";
  }
  return context.stop === "login_wall"
    ? "The site asked for sign-in before this point, so its price and bill stayed out of view."
    : "The run stopped before the page where this appears.";
}

/** The reach rule guards a clean answer. Words already seen on the way count wherever the run stopped. */
const DOES_NOT_APPLY: Record<Flow, string> = {
  checkout: "This belongs to subscriptions, not a one-off purchase.",
  subscription: "This belongs to a one-off purchase, not a subscription sign-up.",
};

export function judgePattern(definition: Definition, context: PatternContext): Draft {
  const { evidence, bill, flow } = context;
  const applies = definition.flows?.includes(flow) ?? true;
  if (!evidence || !bill) {
    return applies
      ? draft("not_checked", unreachedNote(context, definition.needs))
      : draft("not_applicable", DOES_NOT_APPLY[flow]);
  }

  const judged = definition.rule({ ...context, evidence, bill });
  if (judged?.status === "found") return judged;
  if (!applies) return draft("not_applicable", DOES_NOT_APPLY[flow]);
  if (!reached(context.reach, definition.needs)) {
    return draft("not_checked", unreachedNote(context, definition.needs));
  }
  if (!evidence.reported.has(definition.signal)) {
    return draft("not_checked", "This run did not look for it.");
  }
  return judged ?? draft("not_found", NOTHING_SEEN);
}
