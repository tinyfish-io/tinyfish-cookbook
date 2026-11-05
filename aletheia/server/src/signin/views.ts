import type { Accepts, ManualReason, SentTo } from "./loginSteps.ts";

export type { Accepts, ManualReason, SentTo };

/** What the sign-in panel is told. It never holds a target, a field's value or anything typed. */
export type StepView = {
  id: number;
  /** The site's own words, when an answer brought up a new error. */
  error: string | null;
  /** The site did nothing with the last answer. */
  stalled?: boolean;
  /** The site's other ways in, labelled as it labels them. */
  options?: { id: string; label: string }[];
} & (
  | { kind: "identifier"; accepts: Accepts; dial: { code: string | null; fixed: boolean } }
  | { kind: "password" }
  | {
      kind: "code";
      length: number | null;
      digitsOnly: boolean;
      channel: "sms" | "email" | "app" | null;
      sentTo: SentTo | null;
      resend: "ready" | "waiting" | "none";
    }
  | { kind: "choice" }
  | { kind: "manual"; reason: ManualReason }
  | { kind: "signed_in" }
  | { kind: "opening" }
  | { kind: "failed" }
);

export type SignInState = "setting_up" | "ready" | "in_use";

export interface SignInView {
  id: string;
  url: string;
  host: string;
  /** The brand's own name for the site, when the brand data knows it. */
  name: string | null;
  state: SignInState;
  /** One line on how the sign-in had to connect, or null. */
  notice: string | null;
  expiresAt: string;
  /** What the sign-in panel should ask next. Null once the sign-in is saved. */
  step: StepView | null;
}

export type SignInAction =
  | { kind: "answer"; stepId: number; text: string; dialCode?: string | undefined }
  | { kind: "choose"; optionId: string }
  | { kind: "resend" }
  | { kind: "refresh" }
  | { kind: "restart" }
  | { kind: "manual"; width: number; height: number }
  | { kind: "resume" };
