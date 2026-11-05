import type { ManualReason, StepView } from "./types.ts";

type Step<K extends StepView["kind"]> = Extract<StepView, { kind: K }>;

const ASKS_FOR: Record<Step<"identifier">["accepts"], string> = {
  email: "your email",
  phone: "your phone number",
  username: "your username",
  email_or_phone: "your email or phone number",
};

function codeQuestion({ sentTo, channel }: Step<"code">, name: string): string {
  if (sentTo?.kind === "phone") {
    return `Enter the code ${name} sent to the number ending ${sentTo.ending}`;
  }
  if (sentTo?.kind === "email") return `Enter the code ${name} sent to ${sentTo.address}`;
  switch (channel) {
    case "app":
      return "Enter the code from your authenticator app";
    case "sms":
      return `Enter the code ${name} texted you`;
    case "email":
      return `Enter the code ${name} emailed you`;
    default:
      return `Enter the code ${name} sent you`;
  }
}

/** One plain question per screen, naming the site. */
export function question(step: StepView, name: string): string {
  switch (step.kind) {
    case "identifier":
      return `${name} wants ${ASKS_FOR[step.accepts]}`;
    case "password":
      return `Enter your ${name} password`;
    case "code":
      return codeQuestion(step, name);
    case "choice":
      return `How do you want to sign in to ${name}?`;
    default:
      return `Signing in to ${name}`;
  }
}

/** A site's boxes are only a hint: codes run from 4 to 8 characters and can hold letters. */
export function codeNote({ length }: Step<"code">): string | null {
  return length === null ? null : `Usually ${length} characters.`;
}

export function cleanCode(text: string): string {
  return text.replace(/[\s-]+/g, "");
}

const WRONG = /wrong|incorrect|invalid|not valid|does ?n[o']t match|did not match|mismatch/i;

export function errorLine({ error, stalled, kind }: StepView, name: string): string | null {
  if (stalled) return `${name} did not respond. Please try again.`;
  if (!error) return null;
  if (WRONG.test(error) && kind === "code") return `${name} says the code is wrong.`;
  if (WRONG.test(error) && kind === "password") return `${name} says the password is wrong.`;
  return `${name} says: ${error}`;
}

export function manualCopy(reason: ManualReason, name: string): { title: string; body: string } {
  switch (reason) {
    case "captcha":
      return {
        title: `${name} wants to check you are a person`,
        body: "Finish the check on this page, then press Done.",
      };
    case "social":
      return {
        title: `Finish signing in to ${name}`,
        body: "This step is on another company's page. Finish it here, then press Done.",
      };
    case "passkey":
      return {
        title: `${name} is asking for a passkey`,
        body: "Pick another way to sign in on this page if you can, then press Done.",
      };
    case "unreadable":
      return {
        title: `${name} has a step Aletheia cannot read`,
        body: "Finish this step on the page itself, then press Done.",
      };
    case "asked":
      return {
        title: `${name}'s own page`,
        body: "Finish this step on the page itself, then press Done.",
      };
  }
}

interface Size {
  width: number;
  height: number;
}

const BARS_HEIGHT = 224;
const MIN_SIDE = 240;
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 800;

/** The site is laid out for the space the visitor really has, so nothing needs zooming. */
export function viewportForScreen({ width, height }: Size): Size {
  return {
    width: Math.max(MIN_SIDE, Math.min(width, MAX_WIDTH)),
    height: Math.max(MIN_SIDE, Math.min(height - BARS_HEIGHT, MAX_HEIGHT)),
  };
}
