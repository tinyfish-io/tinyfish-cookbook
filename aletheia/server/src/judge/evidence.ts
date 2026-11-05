import { z } from "zod";

import type { PatternId, PatternStatus, PlanOption, StopPoint, Term } from "./types.ts";
import { PATTERN_IDS } from "./types.ts";

/** Names the agent used before the pattern set changed, so saved runs can be judged again. */
const OLD_PATTERN_NAMES: Readonly<Record<string, PatternId>> = {
  confirm_shaming: "confirmshaming",
  disguised_advertisement: "disguised_ad",
};

// Agent output is untrusted: a field of the wrong shape becomes "absent", never a crash.
const num = z.number().nullish().catch(null);
const str = z.string().nullish().catch(null);
const step = z.number().int().nullish().catch(null);

function list<T extends z.ZodType>(item: T) {
  return z.array(item.nullable().catch(null)).nullish().catch([]);
}

/** Runs saved before signals said "none seen" gave a plain list, read here as the same thing. */
function unwrapSignal(value: unknown): unknown {
  if (value && typeof value === "object" && "items" in value) return value.items;
  return value;
}

function signal<T extends z.ZodType>(item: T) {
  return z.preprocess(unwrapSignal, list(item));
}

/** Terms and pattern checks come keyed by name now, and as lists in older runs. */
function keyedList(value: unknown, nameField: string): unknown {
  if (Array.isArray(value) || !value || typeof value !== "object") return value;
  return Object.entries(value).map(([name, entry]: [string, unknown]) => ({
    ...(entry as object),
    [nameField]: name,
  }));
}

const pageSchema = z.object({
  step: z.number().int(),
  page: z.string().catch("Page"),
  url: str,
  note: str,
  total_shown: num,
  price_shown: num,
});

const feeSchema = z.object({
  name: z.string(),
  amount: num,
  first_seen_at_step: step,
  included_in_first_price: z.boolean().nullish().catch(null),
});

const preTickedSchema = z.object({
  label: z.string(),
  cost: num,
  included_in_total: z.boolean().nullish().catch(null),
  seen_at_step: step,
});

const addedSchema = z.object({ name: z.string(), cost: num, seen_at_step: step });

const pressureSchema = z.object({ text: z.string(), seen_at_step: step });

const declineSchema = z.preprocess(
  (value) => (typeof value === "string" ? { text: value } : value),
  z.object({ text: z.string(), seen_at_step: step }),
);

const consentSchema = z.object({
  text: z.string(),
  seen_at_step: step,
  can_decline_separately: z.boolean().nullish().catch(null),
});

const termSchema = z.object({
  term: z.enum([
    "trial",
    "renewal",
    "price_after_intro",
    "cancellation",
    "cancellation_fee",
    "trial_card",
  ]),
  quote: str,
  shown_where: z
    .enum(["main_page", "fine_print", "info_icon", "faq", "later_page", "not_shown"])
    .catch("not_shown"),
  seen_at_step: step,
});

const planOptionSchema = z.object({
  label: z.string(),
  price: num,
  period: str,
  commitment: str,
  fee_line: str,
  selected_by_default: z.boolean().nullish().catch(null),
  first_seen_at_step: step,
});

const priceAnchorSchema = z.object({
  quote: z.string(),
  price: z.number(),
  reference_price: z.number(),
  seen_at_step: step,
});

const cookieBannerSchema = z.object({ accept_label: str, reject_label: str, seen_at_step: step });

const emphasisSchema = z.object({
  prominent: z.string(),
  muted: z.string(),
  seen_at_step: step,
});

const repeatedPromptSchema = z.object({
  text: z.string(),
  seen_at_steps: z.array(z.number().int()).catch([]),
});

const patternCheckSchema = z.object({
  pattern: z.string(),
  status: z.enum(["found", "seen", "none_seen", "not_found", "not_checked"]),
  quote: str,
  seen_at_step: step,
  note: str,
});

const resultSchema = z.object({
  stopped_at: str,
  stop_note: str,
  stopped_reason: str,
  login_wall_at: str,
  login_prompt: str,
  login_required: z.boolean().nullish().catch(null),
  reached_payment_page: z.boolean().nullish().catch(null),
  blocked_by_bot_protection: z.boolean().nullish().catch(null),
  bill_itemised: z.boolean().nullish().catch(null),
  item_name: str,
  item_listed_price: num,
  plan_name: str,
  billing_period: str,
  plan_default_selected: str,
  currency: str,
  origin: str,
  destination: str,
  first_price_shown: num,
  intro_price: num,
  intro_period: str,
  price_after_intro: num,
  final_price: num,
  steps: list(pageSchema),
  fees: signal(feeSchema),
  pre_ticked_options: signal(preTickedSchema),
  added_without_asking: signal(addedSchema),
  pressure_messages: signal(pressureSchema),
  decline_wording: signal(declineSchema),
  consent_text: signal(consentSchema),
  terms: z.preprocess((value) => keyedList(value, "term"), list(termSchema)),
  plan_options: signal(planOptionSchema),
  pattern_checks: z.preprocess((value) => keyedList(value, "pattern"), list(patternCheckSchema)),
  cart_item_count: step,
  price_anchors: signal(priceAnchorSchema),
  cookie_banners: signal(cookieBannerSchema),
  emphasis_pairs: signal(emphasisSchema),
  repeated_prompts: signal(repeatedPromptSchema),
});

export interface EvidencePage {
  step: number;
  name: string;
  url: string | null;
  note: string | null;
  price: number | null;
}

export interface EvidenceFee {
  name: string;
  amount: number | null;
  firstSeenAtStep: number | null;
  includedInFirstPrice: boolean | null;
}

export interface PreTicked {
  label: string;
  cost: number | null;
  includedInTotal: boolean | null;
  seenAtStep: number | null;
}

export interface Added {
  name: string;
  cost: number | null;
  seenAtStep: number | null;
}

export interface Pressure {
  text: string;
  seenAtStep: number | null;
  /** Set when the page's own wording already says which pattern this is. */
  kind?: PatternId;
}

export type Decline = Pressure;

export interface Consent {
  text: string;
  seenAtStep: number | null;
  canDeclineSeparately: boolean | null;
}

export interface PriceAnchor {
  quote: string;
  price: number;
  referencePrice: number;
  seenAtStep: number | null;
}

export interface CookieBanner {
  accept: string | null;
  reject: string | null;
  seenAtStep: number | null;
}

export interface EmphasisPair {
  prominent: string;
  muted: string;
  seenAtStep: number | null;
}

export interface RepeatedPrompt {
  text: string;
  steps: number[];
}

export interface PatternCheck {
  status: PatternStatus;
  quote: string | null;
  seenAtStep: number | null;
  note: string | null;
}

export interface Evidence {
  stoppedAt: string | null;
  stopPoint: StopPoint;
  stopNote: string | null;
  loginWallAt: string | null;
  loginPrompt: string | null;
  billItemised: boolean;
  itemName: string | null;
  listedPrice: number | null;
  planName: string | null;
  billingPeriod: string | null;
  defaultSelected: string | null;
  currency: string | null;
  origin: string | null;
  destination: string | null;
  introPrice: number | null;
  introPeriod: string | null;
  priceAfterIntro: number | null;
  finalPrice: number | null;
  pages: EvidencePage[];
  fees: EvidenceFee[];
  preTicked: PreTicked[];
  added: Added[];
  pressure: Pressure[];
  declineWording: Decline[];
  consent: Consent[];
  terms: Term[];
  planOptions: PlanOption[];
  checks: Partial<Record<PatternId, PatternCheck>>;
  cartItemCount: number | null;
  priceAnchors: PriceAnchor[];
  cookieBanners: CookieBanner[];
  emphasisPairs: EmphasisPair[];
  repeatedPrompts: RepeatedPrompt[];
  /** The fields this run filled in, since an older agent was never asked for some of them. */
  reported: ReadonlySet<string>;
}

const STOP_POINTS: ReadonlySet<string> = new Set<StopPoint>([
  "payment_page",
  "login_wall",
  "contact_required",
  "blocked",
  "error",
  "incomplete",
]);

function present<T>(items: readonly (T | null)[] | null | undefined): T[] {
  return (items ?? []).filter((item): item is T => item !== null);
}

/** Runs from before the schema gained `stopped_at` reported the same facts as booleans. */
function legacyStop(raw: z.infer<typeof resultSchema>): StopPoint {
  if (raw.blocked_by_bot_protection) return "blocked";
  if (raw.login_required) return "login_wall";
  if (raw.reached_payment_page) return "payment_page";
  return "incomplete";
}

function stopPoint(raw: z.infer<typeof resultSchema>): StopPoint {
  if (raw.stopped_at && STOP_POINTS.has(raw.stopped_at)) return raw.stopped_at as StopPoint;
  return raw.stopped_at ? "incomplete" : legacyStop(raw);
}

const CURRENCY_SYMBOLS: readonly (readonly [RegExp, string])[] = [
  [/\u20B9|^rs\.?$/i, "INR"],
  [/\$/, "USD"],
  [/\u20AC/, "EUR"],
  [/\u00A3/, "GBP"],
];

/** Agents write "month", "/mo" or "per month" for the same thing. */
function bareBillingPeriod(value: string | null | undefined): string | null {
  return value?.replace(/^\s*(\/|per\b)\s*/i, "").trim() || null;
}

/** Agents write the code on some runs and the symbol on others. */
function currencyCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.match(/\b[A-Z]{3}\b/)?.[0];
  if (code) return code;
  return CURRENCY_SYMBOLS.find(([symbol]) => symbol.test(value.trim()))?.[1] ?? null;
}

/**
 * The fields the agent truly answered. "Seen" with nothing listed is no answer at all, and a
 * signal left out means the agent never looked, which is not the same as seeing none.
 */
function answered(result: Record<string, unknown>): Set<string> {
  const unanswered = ([, value]: [string, unknown]) =>
    !!value &&
    typeof value === "object" &&
    "status" in value &&
    "items" in value &&
    value.status !== "none_seen" &&
    (!Array.isArray(value.items) || value.items.length === 0);
  return new Set(
    Object.entries(result)
      .filter((entry) => !unanswered(entry))
      .map(([name]) => name),
  );
}

function agentStatus(status: z.infer<typeof patternCheckSchema>["status"]): PatternStatus {
  if (status === "seen") return "found";
  return status === "none_seen" ? "not_found" : status;
}

function isPatternId(name: string): name is PatternId {
  return (PATTERN_IDS as readonly string[]).includes(name);
}

export function parseEvidence(result: Record<string, unknown> | null): Evidence | null {
  if (!result) return null;
  const raw = resultSchema.parse(result);
  const stop = stopPoint(raw);
  const fees = present(raw.fees).map((fee) => ({
    name: fee.name,
    amount: fee.amount ?? null,
    firstSeenAtStep: fee.first_seen_at_step ?? null,
    includedInFirstPrice: fee.included_in_first_price ?? null,
  }));

  const checks: Evidence["checks"] = {};
  for (const check of present(raw.pattern_checks)) {
    const name = OLD_PATTERN_NAMES[check.pattern] ?? check.pattern;
    if (!isPatternId(name)) continue;
    checks[name] = {
      status: agentStatus(check.status),
      quote: check.quote?.trim() || null,
      seenAtStep: check.seen_at_step ?? null,
      note: check.note ?? null,
    };
  }

  return {
    stoppedAt: raw.stopped_at ?? (raw.reached_payment_page ? "payment_page" : null),
    stopPoint: stop,
    stopNote: raw.stop_note ?? raw.stopped_reason ?? null,
    loginWallAt: raw.login_wall_at ?? null,
    loginPrompt: raw.login_prompt ?? null,
    billItemised: raw.bill_itemised ?? fees.some((fee) => fee.amount !== null && fee.amount > 0),
    itemName: raw.item_name ?? null,
    listedPrice: raw.item_listed_price ?? raw.first_price_shown ?? null,
    planName: raw.plan_name ?? null,
    billingPeriod: raw.billing_period ?? null,
    defaultSelected: raw.plan_default_selected ?? null,
    currency: currencyCode(raw.currency),
    origin: raw.origin ?? null,
    destination: raw.destination ?? null,
    introPrice: raw.intro_price ?? null,
    introPeriod: raw.intro_period ?? null,
    priceAfterIntro: raw.price_after_intro ?? null,
    finalPrice: raw.final_price ?? null,
    pages: present(raw.steps).map((page) => ({
      step: page.step,
      name: page.page,
      url: page.url ?? null,
      note: page.note ?? null,
      price: page.total_shown ?? page.price_shown ?? null,
    })),
    fees,
    preTicked: present(raw.pre_ticked_options).map((option) => ({
      label: option.label,
      cost: option.cost ?? null,
      includedInTotal: option.included_in_total ?? null,
      seenAtStep: option.seen_at_step ?? null,
    })),
    added: present(raw.added_without_asking).map((item) => ({
      name: item.name,
      cost: item.cost ?? null,
      seenAtStep: item.seen_at_step ?? null,
    })),
    pressure: present(raw.pressure_messages).map((message) => ({
      text: message.text,
      seenAtStep: message.seen_at_step ?? null,
    })),
    declineWording: present(raw.decline_wording).map((decline) => ({
      text: decline.text,
      seenAtStep: decline.seen_at_step ?? null,
    })),
    consent: present(raw.consent_text).map((consent) => ({
      text: consent.text,
      seenAtStep: consent.seen_at_step ?? null,
      canDeclineSeparately: consent.can_decline_separately ?? null,
    })),
    terms: present(raw.terms).map((term) => ({
      term: term.term,
      quote: term.quote ?? null,
      shownWhere: term.shown_where,
      seenAtStep: term.seen_at_step ?? null,
    })),
    planOptions: present(raw.plan_options).map((option) => ({
      label: option.label,
      price: option.price ?? null,
      period: bareBillingPeriod(option.period),
      commitment: option.commitment ?? null,
      feeLine: option.fee_line ?? null,
      selectedByDefault: option.selected_by_default ?? false,
      firstSeenAtStep: option.first_seen_at_step ?? null,
    })),
    checks,
    cartItemCount: raw.cart_item_count ?? null,
    priceAnchors: present(raw.price_anchors).map((anchor) => ({
      quote: anchor.quote,
      price: anchor.price,
      referencePrice: anchor.reference_price,
      seenAtStep: anchor.seen_at_step ?? null,
    })),
    cookieBanners: present(raw.cookie_banners).map((banner) => ({
      accept: banner.accept_label ?? null,
      reject: banner.reject_label ?? null,
      seenAtStep: banner.seen_at_step ?? null,
    })),
    emphasisPairs: present(raw.emphasis_pairs).map((pair) => ({
      prominent: pair.prominent,
      muted: pair.muted,
      seenAtStep: pair.seen_at_step ?? null,
    })),
    repeatedPrompts: present(raw.repeated_prompts).map((prompt) => ({
      text: prompt.text,
      steps: prompt.seen_at_steps,
    })),
    reported: answered(result),
  };
}
