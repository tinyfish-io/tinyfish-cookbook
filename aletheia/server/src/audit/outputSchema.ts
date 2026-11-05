import { TERM_NAMES } from "../judge/types.ts";

const nullableString = { type: "string", nullable: true } as const;
const nullableNumber = { type: "number", nullable: true } as const;
const nullableInteger = { type: "integer", nullable: true } as const;
const nullableBoolean = { type: "boolean", nullable: true } as const;

function objectOf<const P extends Record<string, unknown>>(properties: P) {
  return { type: "object", properties, required: Object.keys(properties) } as const;
}

function arrayOf<const I>(items: I) {
  return { type: "array", items } as const;
}

/**
 * A signal the agent must answer for. An empty list could mean "looked, saw none" or "never
 * looked"; only the first earns a clean result, so the agent has to say which.
 */
function signalOf<const I>(items: I) {
  return objectOf({
    status: { type: "string", enum: ["seen", "none_seen"] },
    items: arrayOf(items),
  });
}

/** The patterns only the agent can spot. Every other pattern comes from the lists below. */
export const AGENT_PATTERNS = [
  "partitioned_pricing",
  "bait_and_switch",
  "free_claim",
  "hidden_subscription",
  "price_behind_signin",
  "forced_action",
  "trick_question",
  "disguised_ad",
] as const;

const term = objectOf({
  quote: nullableString,
  shown_where: {
    type: "string",
    enum: ["main_page", "fine_print", "info_icon", "faq", "later_page", "not_shown"],
  },
  seen_at_step: nullableInteger,
});

const patternCheck = objectOf({
  status: { type: "string", enum: ["seen", "none_seen"] },
  quote: nullableString,
  seen_at_step: nullableInteger,
  note: nullableString,
});

function keyed<const K extends string, V>(names: readonly K[], value: V) {
  const entries = names.map((name) => [name, value]);
  return objectOf(Object.fromEntries(entries) as Record<K, V>);
}

const properties = {
  stopped_at: {
    type: "string",
    enum: ["incomplete", "payment_page", "login_wall", "contact_required", "blocked", "error"],
  },
  stop_note: nullableString,
  login_wall_at: nullableString,
  login_prompt: nullableString,
  bill_itemised: { type: "boolean" },
  item_name: nullableString,
  item_listed_price: nullableNumber,
  plan_name: nullableString,
  billing_period: nullableString,
  plan_default_selected: nullableString,
  currency: nullableString,
  origin: nullableString,
  destination: nullableString,
  first_price_shown: nullableNumber,
  intro_price: nullableNumber,
  intro_period: nullableString,
  price_after_intro: nullableNumber,
  final_price: nullableNumber,
  cart_item_count: nullableInteger,
  removed_from_cart: arrayOf(objectOf({ name: { type: "string" }, price: nullableNumber })),
  steps: arrayOf(
    objectOf({
      step: { type: "integer" },
      page: { type: "string" },
      url: nullableString,
      price_shown: nullableNumber,
      note: nullableString,
    }),
  ),
  fees: signalOf(
    objectOf({
      name: { type: "string" },
      amount: nullableNumber,
      first_seen_at_step: nullableInteger,
      included_in_first_price: nullableBoolean,
    }),
  ),
  pre_ticked_options: signalOf(
    objectOf({
      label: { type: "string" },
      cost: nullableNumber,
      included_in_total: nullableBoolean,
      seen_at_step: nullableInteger,
    }),
  ),
  added_without_asking: signalOf(
    objectOf({
      name: { type: "string" },
      cost: nullableNumber,
      seen_at_step: nullableInteger,
    }),
  ),
  pressure_messages: signalOf(
    objectOf({ text: { type: "string" }, seen_at_step: nullableInteger }),
  ),
  decline_wording: signalOf(objectOf({ text: { type: "string" }, seen_at_step: nullableInteger })),
  consent_text: signalOf(
    objectOf({
      text: { type: "string" },
      seen_at_step: nullableInteger,
      can_decline_separately: nullableBoolean,
    }),
  ),
  terms: keyed(TERM_NAMES, term),
  plan_options: signalOf(
    objectOf({
      label: { type: "string" },
      price: nullableNumber,
      period: nullableString,
      commitment: nullableString,
      fee_line: nullableString,
      selected_by_default: nullableBoolean,
      first_seen_at_step: nullableInteger,
    }),
  ),
  price_anchors: signalOf(
    objectOf({
      quote: { type: "string" },
      price: { type: "number" },
      reference_price: { type: "number" },
      seen_at_step: nullableInteger,
    }),
  ),
  cookie_banners: signalOf(
    objectOf({
      accept_label: nullableString,
      reject_label: nullableString,
      seen_at_step: nullableInteger,
    }),
  ),
  emphasis_pairs: signalOf(
    objectOf({
      prominent: { type: "string" },
      muted: { type: "string" },
      seen_at_step: nullableInteger,
    }),
  ),
  repeated_prompts: signalOf(
    objectOf({ text: { type: "string" }, seen_at_steps: arrayOf({ type: "integer" }) }),
  ),
  pattern_checks: keyed(AGENT_PATTERNS, patternCheck),
} as const;

/** One generic schema for every site and flow: fields a flow has no use for come back null. */
export const OUTPUT_SCHEMA = objectOf(properties);

export const LOGOUT_SCHEMA = objectOf({
  logged_out: { type: "boolean" },
  note: nullableString,
});
