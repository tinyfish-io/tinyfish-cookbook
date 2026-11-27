import type { Dial, LoginStep, ManualReason, Target } from "./loginSteps.ts";
import { isDeadEnd, readStep } from "./loginSteps.ts";
import type { PageScan } from "./pageScan.ts";
import type { StepView } from "./views.ts";

export interface LoginPage {
  scan(): Promise<PageScan>;
  goto(url: string): Promise<void>;
  click(target: Target): Promise<void>;
  /** Types into a field, or across a row of single-character boxes. */
  enter(fields: Target[], text: string): Promise<void>;
  pressEnter(field: Target): Promise<void>;
  choose(select: Target, dialCode: string): Promise<void>;
}

export interface Answer {
  text: string;
  dialCode?: string | undefined;
}

export interface GuidedOptions {
  url: string;
  /** Where the login is, when the page at `url` has no way in. */
  loginUrl: string | null;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
  settlePolls?: number;
}

export const COMMON_LOGIN_PATHS = ["/login", "/signin", "/sign-in", "/account/login", "/account"];

const POLL_MS = 500;
const SETTLE_POLLS = 24;
const MAX_LOGIN_CLICKS = 3;
const FIND_LOGIN_LIMIT_MS = 70_000;
const AUTO_SUBMIT_POLLS = 3;

/** The number as the site's field wants it, given where the site shows the country code. */
export function phoneToType(
  { national, dialCode }: { national: string; dialCode: string | undefined },
  dial: Pick<Dial, "code" | "fixed" | "select">,
  fieldType: string,
): string {
  const digits = national.replace(/[^\d]/g, "");
  if (!dialCode || dial.code || dial.select) return digits;
  return fieldType === "number" ? `${dialCode.slice(1)}${digits}` : `${dialCode}${digits}`;
}

function sameQuestion(a: LoginStep, b: LoginStep): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== "identifier" || (b.kind === "identifier" && a.accepts === b.accepts);
}

const errorsOf = (scan: PageScan) => new Set(scan.frames.flatMap(({ errors }) => errors));

export class GuidedLogin {
  readonly #page: LoginPage;
  readonly #url: string;
  readonly #loginUrl: string | null;
  readonly #wait: (ms: number) => Promise<void>;
  readonly #now: () => number;
  readonly #settlePolls: number;

  #step: LoginStep = { kind: "no_form", loginControl: null };
  #stepId = 0;
  #error: string | null = null;
  #stalled = false;
  #answered = false;

  constructor(page: LoginPage, options: GuidedOptions) {
    this.#page = page;
    this.#url = options.url;
    this.#loginUrl = options.loginUrl;
    this.#wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.#now = options.now ?? Date.now;
    this.#settlePolls = options.settlePolls ?? SETTLE_POLLS;
  }

  async open(): Promise<StepView> {
    await this.#page.goto(this.#loginUrl ?? this.#url);
    await this.#findLogin();
    return this.#publish();
  }

  async restart(): Promise<StepView> {
    this.#answered = false;
    return this.open();
  }

  async refresh(): Promise<StepView> {
    const { step } = await this.#read();
    if (sameQuestion(step, this.#step)) {
      this.#step = step;
      return this.#view();
    }
    this.#error = null;
    this.#step = step;
    return this.#publish();
  }

  async answer(stepId: number, { text, dialCode }: Answer): Promise<StepView> {
    if (stepId !== this.#stepId) return this.#view();

    const { step, scan } = await this.#read();
    if (!sameQuestion(step, this.#step)) {
      this.#step = step;
      this.#error = null;
      return this.#publish();
    }

    const before = errorsOf(scan);
    this.#error = null;

    switch (step.kind) {
      case "identifier": {
        if (step.accepts === "phone" && dialCode && step.dial.select) {
          await this.#page.choose(step.dial.select, dialCode);
        }
        const type = step.accepts === "phone" ? this.#fieldType(scan, step.field) : "";
        const typed =
          step.accepts === "phone"
            ? phoneToType({ national: text, dialCode }, step.dial, type)
            : text;
        await this.#page.enter([step.field], typed);
        if (!step.submitNow) return this.#settle(before, step);
        await this.#press(step);
        break;
      }
      case "password":
        await this.#page.enter([step.field], text);
        await this.#press(step);
        break;
      case "code": {
        await this.#page.enter(step.fields, text.replace(/\s+/g, ""));
        if (!(await this.#movedOnAlone(step))) await this.#press(step);
        break;
      }
      default:
        return this.#view();
    }

    this.#answered = true;
    return this.#settle(before, step);
  }

  async choose(optionId: string): Promise<StepView> {
    const { step, scan } = await this.#read();
    const options = "options" in step ? step.options : [];
    const option = options.find(({ id }) => id === optionId);
    if (!option) {
      this.#step = step;
      return this.#publish();
    }

    await this.#page.click(option.target);
    if (option.social) {
      this.#answered = true;
      this.#step = { kind: "manual", reason: "social" };
      this.#error = null;
      return this.#publish();
    }
    return this.#settle(errorsOf(scan), step);
  }

  async resend(): Promise<StepView> {
    const { step } = await this.#read();
    this.#step = step;
    if (step.kind === "code" && step.resend?.ready) await this.#page.click(step.resend.target);
    return this.#publish();
  }

  /** The person asked for the page itself, or a step needs them. */
  handOver(reason: ManualReason = "asked"): StepView {
    this.#step = { kind: "manual", reason };
    this.#error = null;
    return this.#publish();
  }

  /** The person finished on the page itself and is back. */
  async resume(): Promise<StepView> {
    this.#answered = true;
    this.#error = null;
    const { step } = await this.#read();
    this.#step = step.kind === "no_form" && !step.loginControl ? { kind: "signed_in" } : step;
    if (this.#step.kind === "trust") await this.#declineTrust(this.#step.decline);
    return this.#publish();
  }

  view(): StepView {
    return this.#view();
  }

  #fieldType(scan: PageScan, target: Target): string {
    const frame = scan.frames.find(({ index }) => index === target.frame);
    return frame?.fields.find(({ ref }) => ref === target.ref)?.type ?? "text";
  }

  async #read(): Promise<{ scan: PageScan; step: LoginStep }> {
    const scan = await this.#page.scan();
    return { scan, step: readStep(scan, { answered: this.#answered }) };
  }

  async #findLogin(): Promise<void> {
    const deadline = this.#now() + FIND_LOGIN_LIMIT_MS;
    const paths = [...COMMON_LOGIN_PATHS];
    let clicks = 0;

    for (;;) {
      const step = await this.#settleOnForm();
      this.#step = step;
      if (step.kind !== "no_form") return;

      if (step.loginControl && clicks < MAX_LOGIN_CLICKS) {
        clicks += 1;
        await this.#page.click(step.loginControl);
        continue;
      }

      const path = paths.shift();
      if (!path || this.#now() > deadline) {
        this.#step = { kind: "manual", reason: "unreadable" };
        return;
      }
      await this.#page.goto(new URL(path, this.#url).href);
    }
  }

  /** A page can take a moment to draw its form, and a login dialog longer. */
  async #settleOnForm(): Promise<LoginStep> {
    let { step, scan } = await this.#read();
    for (let poll = 0; poll < this.#settlePolls && step.kind === "no_form"; poll += 1) {
      if (step.loginControl || isDeadEnd(scan)) break;
      await this.#wait(POLL_MS);
      ({ step, scan } = await this.#read());
    }
    return step;
  }

  async #press(step: Extract<LoginStep, { submit: unknown }>): Promise<void> {
    for (const box of step.untick) await this.#page.click(box);
    if (step.submit) {
      await this.#page.click(step.submit);
      return;
    }
    const field = step.kind === "code" ? step.fields[0] : "field" in step ? step.field : undefined;
    if (field) await this.#page.pressEnter(field);
  }

  /** Many code forms submit themselves on the last character, and a second press can fail them. */
  async #movedOnAlone(step: LoginStep): Promise<boolean> {
    for (let poll = 0; poll < AUTO_SUBMIT_POLLS; poll += 1) {
      const { step: now } = await this.#read();
      if (!sameQuestion(now, step)) return true;
      await this.#wait(POLL_MS);
    }
    return false;
  }

  async #settle(before: Set<string>, asked: LoginStep): Promise<StepView> {
    for (let poll = 0; poll < this.#settlePolls; poll += 1) {
      const { step, scan } = await this.#read();
      const fresh = [...errorsOf(scan)].find((error) => !before.has(error));

      if (step.kind === "trust") {
        await this.#declineTrust(step.decline);
        continue;
      }
      if (fresh) {
        this.#step = step;
        this.#error = fresh;
        return this.#publish();
      }
      if (!sameQuestion(step, asked) || this.#filledNext(step, asked)) {
        this.#step = step;
        return this.#publish();
      }
      await this.#wait(POLL_MS);
    }

    const { step } = await this.#read();
    this.#step = step;
    this.#stalled = sameQuestion(step, asked);
    return this.#publish();
  }

  /** The password that shows beside an identifier is the same form, one question further on. */
  #filledNext(step: LoginStep, asked: LoginStep): boolean {
    return asked.kind === "identifier" && !asked.submitNow && step.kind === "password";
  }

  async #declineTrust(decline: Target): Promise<void> {
    await this.#page.click(decline);
    await this.#wait(POLL_MS);
    const { step } = await this.#read();
    this.#step = step;
  }

  #publish(): StepView {
    this.#stepId += 1;
    const view = this.#view();
    this.#stalled = false;
    return view;
  }

  #view(): StepView {
    const step = this.#step;
    const base = {
      id: this.#stepId,
      error: this.#error,
      ...(this.#stalled ? { stalled: true } : {}),
    };
    const options =
      "options" in step ? step.options.map(({ id, label }) => ({ id, label })) : undefined;

    switch (step.kind) {
      case "identifier":
        return {
          ...base,
          kind: "identifier",
          accepts: step.accepts,
          dial: { code: step.dial.code, fixed: step.dial.fixed },
          ...(options ? { options } : {}),
        };
      case "password":
        return { ...base, kind: "password", ...(options ? { options } : {}) };
      case "code": {
        const { resend } = step;
        return {
          ...base,
          kind: "code",
          length: step.length,
          digitsOnly: step.digitsOnly,
          channel: step.channel,
          sentTo: step.sentTo,
          resend: resend ? (resend.ready ? "ready" : "waiting") : "none",
          ...(options ? { options } : {}),
        };
      }
      case "choice":
        return { ...base, kind: "choice", ...(options ? { options } : {}) };
      case "manual":
        return { ...base, kind: "manual", reason: step.reason };
      case "signed_in":
        return { ...base, kind: "signed_in" };
      case "trust":
      case "no_form":
        return { ...base, kind: "manual", reason: "unreadable" };
    }
  }
}
