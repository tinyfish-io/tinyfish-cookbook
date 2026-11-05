import type { StepRecord } from "../tinyfish/types.ts";
import type { Evidence } from "./evidence.ts";
import type { PageCapture } from "./pageText.ts";
import type { SafetyFlag } from "./types.ts";

// "Input" is left out: agents write "the page with the mobile number input" when they only look.
const ENTRY_VERB = /\b(type[ds]?|enter(ed|s)?|fill(ed|s)?|provide[ds]?)\b/i;
const CONTACT_FIELD = /\b(e-?mail|phone|mobile|contact|otp|one[- ]time|card|cvv|upi)\b/i;
const CONTACT_VALUE = /[\w.+-]+@[\w-]+\.\w+|(?<!\d)\d{10}(?!\d)/;
const CLICK_VERB = /\b(click|press|tap|select|choose|pick)\w*\b/i;
const PAYMENT_TARGET =
  /\b(place order|pay|pay now|proceed to pay|slide to pay|confirm (order|purchase|payment)|payment method|cash on delivery|cod|upi|net ?banking|credit card|debit card|wallet)\b/i;
// A button named "Pay" often only opens an order summary, so a click counts once a payment step shows.
const PAYMENT_FIELDS =
  /card number|name on card|cvv|cvc|expiry date|security code|upi id|enter (your )?upi|vpa|wallet balance|net ?banking/i;
const PAYMENT_PAGE_NAME = /payment (method|options?|page|details)|pay(ment)? with|card details/i;
const PAYMENT_PROVIDER =
  /(^|.)(stripe.com|paypal.com|razorpay.com|paytm.(com|in)|juspay.in|adyen.com|braintreegateway.com|payu.(in|com)|cashfree.com|billdesk.com|ccavenue.com|checkout.com|klarna.com|affirm.com|afterpay.com|phonepe.com|worldpay.com|mercadopago.com)$/i;
const BROWSER_CHANGE = /reconfigur|(switch|chang)\w* .*proxy/i;

function typedContact(action: string): boolean {
  return ENTRY_VERB.test(action) && (CONTACT_FIELD.test(action) || CONTACT_VALUE.test(action));
}

function clickedPayment(action: string): boolean {
  return CLICK_VERB.test(action) && PAYMENT_TARGET.test(action);
}

function providerHost(url: string | null): boolean {
  return url !== null && URL.canParse(url) && PAYMENT_PROVIDER.test(new URL(url).hostname);
}

function reachedPaymentStep(evidence: Evidence | null, captures: readonly PageCapture[]): boolean {
  const pages = evidence?.pages ?? [];
  return (
    pages.some(
      ({ name, url, note }) =>
        PAYMENT_PAGE_NAME.test(name) || providerHost(url) || PAYMENT_FIELDS.test(note ?? ""),
    ) || captures.some(({ text }) => PAYMENT_FIELDS.test(text))
  );
}

/** Goal rules are not a safety boundary, so every run's real actions are read afterwards. */
export function scanSafety(
  actions: readonly StepRecord[],
  evidence: Evidence | null,
  captures: readonly PageCapture[] = [],
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const paymentShown = reachedPaymentStep(evidence, captures);

  for (const step of actions) {
    const action = step.action ?? "";
    if (typedContact(action)) {
      flags.push({
        kind: "contact_entered",
        detail: "The agent typed something that looks like contact details.",
        stepId: step.id,
      });
    }
    if (paymentShown && clickedPayment(action)) {
      flags.push({
        kind: "payment_click",
        detail: "The agent pressed a button that looks like a payment or order action.",
        stepId: step.id,
      });
    }
  }

  const changedAt = actions.find((step) => BROWSER_CHANGE.test(step.action ?? ""));
  const writtenUp = [evidence?.stopNote, ...(evidence?.pages ?? []).map((page) => page.note)].some(
    (text) => BROWSER_CHANGE.test(text ?? ""),
  );
  if (changedAt || writtenUp) {
    flags.push({
      kind: "browser_changed",
      detail:
        "The agent changed its own browser setup mid-run, so the country the site saw is not known.",
      stepId: changedAt?.id ?? null,
    });
  }

  return flags;
}
