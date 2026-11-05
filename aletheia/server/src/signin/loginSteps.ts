import type { PageScan, ScannedControl, ScannedField, ScannedFrame } from "./pageScan.ts";

/** Where something sits on the page, valid until the next scan. */
export interface Target {
  frame: number;
  ref: number;
}

export type Accepts = "email" | "phone" | "username" | "email_or_phone";
export type ManualReason = "captcha" | "social" | "passkey" | "unreadable" | "asked";
export type SentTo = { kind: "phone"; ending: string } | { kind: "email"; address: string };

export interface MethodOption {
  /** Stays the same across scans, unlike a target. */
  id: string;
  label: string;
  target: Target;
  /** Signing in through another company's page, which a person has to finish. */
  social: boolean;
}

interface FormStep {
  options: MethodOption[];
  submit: Target | null;
  /** Remember me and trust boxes that are ticked. The browser goes after one check. */
  untick: Target[];
}

export interface Dial {
  code: string | null;
  /** The site shows one code and offers no select, so the number has to fit it. */
  fixed: boolean;
  select: Target | null;
}

export type LoginStep =
  | (FormStep & {
      kind: "identifier";
      accepts: Accepts;
      field: Target;
      /** False when a password waits on the same page, so the button is pressed after it. */
      submitNow: boolean;
      dial: Dial;
    })
  | (FormStep & { kind: "password"; field: Target })
  | (FormStep & {
      kind: "code";
      fields: Target[];
      length: number | null;
      digitsOnly: boolean;
      channel: "sms" | "email" | "app" | null;
      sentTo: SentTo | null;
      resend: { target: Target; ready: boolean } | null;
    })
  | { kind: "choice"; options: MethodOption[] }
  | { kind: "manual"; reason: ManualReason }
  | { kind: "trust"; decline: Target }
  | { kind: "signed_in" }
  | { kind: "no_form"; loginControl: Target | null };

type FieldKind = Accepts | "password" | "code";

interface Located<T> {
  item: T;
  frame: ScannedFrame;
}

const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 8;
const MIN_CODE_BOXES = 4;
const LOGIN_FORM_SCORE = 3;

const LOGIN_PLACE = /log-?_?in|sign-?_?in|signin|\bauth|\bsso\b|accounts?\.|\/account/i;
const NOT_LOGIN_FIELD =
  /search|locat|\bcity\b|pin ?code|zip|postcode|coupon|promo|quantity|newsletter|subscribe|\bdate\b|birth|name\b(?<!user ?name)/i;
const STREET_ADDRESS = /address/i;
const MAIL = /e-?mail|\bmail\b/i;
const PHONE = /phone|mobile|\bcell\b|whatsapp/i;
const CODE = /\botp\b|one[- ]?time|\bcode\b|\b2fa\b|\bmfa\b|\btotp\b|passcode|\bpin\b/i;
const NOT_A_ONE_TIME_CODE =
  /country|zip|post(al)? ?code|pin ?code|promo|coupon|discount|gift|referral/i;
const USERNAME = /user ?(name|id)|login id|login name/i;

const SUBMIT =
  /^(log ?in|sign ?in|continue|next|submit|verify|confirm|send|get|proceed|go)\b|\botp\b|\bcode\b/i;
const NOT_SUBMIT = /forgot|create|sign ?up|register|help|privacy|terms|cancel|back|subscribe/i;
const SUBSCRIBE = /subscribe|newsletter|join our|sign me up/i;
const SIGN_UP_FIELD = /full name|first name|last name|confirm password|re-?enter password/i;

const RESEND =
  /resend|send (it |the code |code |otp )?again|re-send|new code|didn'?t (get|receive)|send (a )?new/i;
const SOCIAL_NAME = /google|apple|facebook|microsoft|github|twitter|linkedin|\bsso\b/i;
const SOCIAL = new RegExp(
  `^(continue|sign ?in|log ?in|login|sign ?up)( in| up)? (with|using|via) .*(${SOCIAL_NAME.source})|^(${SOCIAL_NAME.source})$`,
  "i",
);
const BARE_SOCIAL_NAME = new RegExp(`^(${SOCIAL_NAME.source})$`, "i");
const METHOD =
  /^(continue|sign ?in|log ?in|login|proceed) (with|using|via) |^use (a |an |my |your )?(password|e-?mail|phone|mobile|code|otp|sms|text|authenticator|different|another|passkey|security key)|^(text|email|call|sms|whatsapp) me|^send (me )?(a |an )?(code|otp|link|text|sms)|^get (a |an )?(code|otp|link)|try another way|other (ways|options)|instead$/i;
/** Pages that will never show a login, so waiting for one to draw is time lost. */
const DEAD_END =
  /you have been blocked|access denied|page (was )?not found|(couldn'?t|could not|can'?t|cannot) find (that|this|the) page/i;
const PASSKEY = /passkey|security key|face id|touch id|windows hello/i;

const LOG_IN_EXACT =
  /^(log ?in|login|sign ?in|signin)$|^(log ?in|sign ?in)( or | ?\/ ?| and | & )(sign ?up|join|register|create)|^(hello|hi),? sign ?in|already have an account|^(log|sign) ?in ?to (your |my )?(account|profile)$/i;
const LOG_IN_LOOSE = /^(my )?(account|profile)$|^log ?in\b|^sign ?in\b/i;
const SIGNED_IN_CONTROL = /^(log ?out|logout|sign ?out|signout)\b|^my (account|profile|orders)$/i;

const REMEMBER = /remember|trust|keep me|stay signed|don'?t ask/i;
const TRUST_PROMPT =
  /trust this (device|browser)|remember this (device|browser)|stay signed in|keep me signed in|don'?t ask again/i;
const DECLINE = /^(no\b|not now|skip|maybe later|don'?t|do not|no,? thanks)/i;

const SENT_LINE = /sent|sending|texted|emailed|delivered|we('| ha)ve|enter the/i;
const MASKED_PHONE = /\+?[\d*xX•·][\d\s*xX•·-]{5,}(\d{2})\b/;
const MASKED_EMAIL = /[\w.*•+-]+@[\w.*•-]+\.\w+/;
const APP_CODE = /authenticator|authentication app|auth app|totp/i;
const SMS_WORDS = /\bsms\b|text message|your (phone|mobile)/i;
const MAIL_WORDS = /e-?mail|inbox/i;

function kindOfField(field: ScannedField): FieldKind | null {
  const words = `${field.name} ${field.label}`;
  if (field.autocomplete === "one-time-code") return "code";
  const oneTime = CODE.test(words) && !NOT_A_ONE_TIME_CODE.test(words);
  if (field.type === "password") return oneTime ? "code" : "password";
  if (oneTime) return "code";

  const mail = MAIL.test(words) || field.type === "email" || field.inputMode === "email";
  const phone =
    PHONE.test(words) ||
    field.type === "tel" ||
    field.inputMode === "tel" ||
    field.autocomplete.startsWith("tel");

  if (mail && phone) return "email_or_phone";
  if (mail || field.autocomplete === "email") return "email";
  if (phone) return "phone";
  if (STREET_ADDRESS.test(words) || NOT_LOGIN_FIELD.test(words)) return null;
  return field.autocomplete === "username" || USERNAME.test(words) ? "username" : null;
}

function isCodeBox(field: ScannedField): boolean {
  return field.maxLength === 1;
}

interface LoginForm {
  frame: ScannedFrame;
  form: number | null;
  fields: { field: ScannedField; kind: FieldKind }[];
  boxes: ScannedField[];
  controls: ScannedControl[];
  score: number;
  signUp: boolean;
}

function loginForms(scan: PageScan): LoginForm[] {
  const forms: LoginForm[] = [];

  for (const frame of scan.frames) {
    const formIds = new Set(frame.fields.map(({ form }) => form));
    for (const form of formIds) {
      const inForm = frame.fields.filter((field) => field.form === form);
      const boxes = inForm.filter(isCodeBox);
      const splitCode = boxes.length >= MIN_CODE_BOXES;
      const known = inForm
        .filter((field) => !(splitCode && isCodeBox(field)))
        .flatMap((field) => {
          const kind = kindOfField(field);
          return kind ? [{ field, kind }] : [];
        });
      if (known.length === 0 && !splitCode) continue;

      const controls = frame.controls.filter(
        (control) => control.form === form || (form !== null && control.form === null),
      );
      const buttons = controls.filter(({ kind }) => kind !== "checkbox");
      const submits = buttons.some(({ text }) => SUBMIT.test(text) && !NOT_SUBMIT.test(text));
      const subscribes = buttons.some(({ text, submit }) => submit && SUBSCRIBE.test(text));
      const asksSecret = known.some(({ kind }) => kind === "password" || kind === "code");

      const signUp =
        known.some(({ field }) => field.autocomplete === "new-password") ||
        inForm.some(({ label, name }) => SIGN_UP_FIELD.test(`${label} ${name}`));

      forms.push({
        frame,
        form,
        fields: known,
        boxes: splitCode ? boxes : [],
        controls,
        signUp,
        score:
          (asksSecret || splitCode ? 5 : 0) +
          (inForm.some(({ inDialog }) => inDialog) ? 3 : 0) +
          (LOGIN_PLACE.test(frame.url) ? 3 : 0) +
          (LOGIN_PLACE.test(scan.url) ? 2 : 0) +
          (submits ? 3 : 0) -
          (subscribes ? 8 : 0),
      });
    }
  }

  return forms.toSorted((a, b) => b.score - a.score);
}

const target = (frame: ScannedFrame, { ref }: { ref: number }): Target => ({
  frame: frame.index,
  ref,
});

function submitOf({ frame, controls }: LoginForm): Target | null {
  const buttons = controls.filter(
    ({ kind, disabled, text }) => kind !== "checkbox" && !disabled && !RESEND.test(text),
  );
  const clear = ({ text }: ScannedControl) => !NOT_SUBMIT.test(text) && !SOCIAL.test(text);
  const best =
    buttons.find((control) => control.submit && clear(control) && !METHOD.test(control.text)) ??
    buttons.find((control) => clear(control) && SUBMIT.test(control.text)) ??
    buttons.find((control) => control.submit && clear(control));
  return best ? target(frame, best) : null;
}

/** A bare brand name only signs in from a button; as a link it is the footer's follow link. */
function isSocial({ text, kind }: ScannedControl): boolean {
  return SOCIAL.test(text) && !(kind === "link" && BARE_SOCIAL_NAME.test(text));
}

function optionId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function methodOptions(scan: PageScan, home: ScannedFrame | null, skip: Target | null) {
  const found = new Map<string, MethodOption>();
  for (const frame of scan.frames) {
    for (const control of frame.controls) {
      if (control.kind === "checkbox" || control.disabled) continue;
      if (skip?.frame === frame.index && skip.ref === control.ref) continue;
      const social = isSocial(control);
      const method = (!home || frame === home) && METHOD.test(control.text);
      if (!social && !method) continue;
      if (NOT_SUBMIT.test(control.text) || RESEND.test(control.text)) continue;
      const id = optionId(control.text);
      if (!found.has(id)) {
        found.set(id, { id, label: control.text, target: target(frame, control), social });
      }
    }
  }
  return [...found.values()];
}

function codeSent(text: string) {
  const line = text.split("\n").find((entry) => SENT_LINE.test(entry)) ?? "";
  const address = MASKED_EMAIL.exec(line)?.[0];
  const ending = MASKED_PHONE.exec(line)?.[1];

  const sentTo: SentTo | null = address
    ? { kind: "email", address }
    : ending
      ? { kind: "phone", ending }
      : null;

  let channel: "sms" | "email" | "app" | null = null;
  if (APP_CODE.test(text)) channel = "app";
  else if (sentTo) channel = sentTo.kind === "email" ? "email" : "sms";
  else if (MAIL_WORDS.test(line)) channel = "email";
  else if (SMS_WORDS.test(text)) channel = "sms";

  return { sentTo, channel };
}

function codeStep(form: LoginForm, base: FormStep): LoginStep {
  const { frame, boxes, fields, controls } = form;
  const asked =
    boxes.length > 0
      ? boxes
      : fields.filter(({ kind }) => kind === "code").map((entry) => entry.field);
  const first = asked[0];
  const declared = first?.maxLength ?? null;
  const fits = declared !== null && declared >= MIN_CODE_LENGTH && declared <= MAX_CODE_LENGTH;
  const resend = controls.find(({ text, kind }) => kind !== "checkbox" && RESEND.test(text));

  return {
    ...base,
    kind: "code",
    fields: asked.map((field) => target(frame, field)),
    length: boxes.length > 0 ? boxes.length : fits ? declared : null,
    digitsOnly: asked.every(
      ({ type, inputMode, pattern }) =>
        type === "tel" ||
        type === "number" ||
        inputMode === "numeric" ||
        inputMode === "tel" ||
        /^(\[0-9\]|\\d)/.test(pattern),
    ),
    resend: resend ? { target: target(frame, resend), ready: !resend.disabled } : null,
    ...codeSent(frame.text),
  };
}

function stepFromForm(form: LoginForm, scan: PageScan): LoginStep {
  const { frame, fields, controls, boxes } = form;
  const submit = submitOf(form);
  const base: FormStep = {
    submit,
    options: methodOptions(scan, frame, submit),
    untick: controls
      .filter(({ kind, checked, text }) => kind === "checkbox" && checked && REMEMBER.test(text))
      .map((control) => target(frame, control)),
  };

  if (boxes.length > 0 || fields.some(({ kind }) => kind === "code")) return codeStep(form, base);

  const password = fields.find(({ kind }) => kind === "password");
  const identifier = fields.find(({ kind }) => kind !== "password");

  if (identifier && (!password || !identifier.field.filled)) {
    const { dial } = identifier.field;
    return {
      ...base,
      kind: "identifier",
      accepts: identifier.kind as Accepts,
      field: target(frame, identifier.field),
      submitNow: !password,
      dial: {
        code: dial?.code ?? null,
        fixed: dial !== null && dial.select === null,
        select: dial?.select != null ? { frame: frame.index, ref: dial.select } : null,
      },
    };
  }
  return { ...base, kind: "password", field: target(frame, (password ?? identifier)!.field) };
}

function allControls(scan: PageScan): Located<ScannedControl>[] {
  return scan.frames.flatMap((frame) =>
    frame.controls
      .filter(({ kind, disabled }) => kind !== "checkbox" && !disabled)
      .map((item) => ({ item, frame })),
  );
}

function findLoginControl(scan: PageScan, signUp: LoginForm | undefined): Target | null {
  const controls = allControls(scan);
  const pick =
    controls.find(({ item }) => LOG_IN_EXACT.test(item.text)) ??
    (signUp ? undefined : controls.find(({ item }) => LOG_IN_LOOSE.test(item.text)));
  return pick ? target(pick.frame, pick.item) : null;
}

function trustPrompt(scan: PageScan): Target | null {
  for (const frame of scan.frames) {
    if (!TRUST_PROMPT.test(frame.text)) continue;
    const decline = frame.controls.find(
      ({ text, kind }) => kind !== "checkbox" && DECLINE.test(text),
    );
    if (decline) return target(frame, decline);
  }
  return null;
}

/** The browser's own error page when its country connection cannot reach the site. */
const PROXY_FAILURE = /ERR_(TUNNEL|PROXY)_CONNECTION_FAILED/;

export function isProxyFailure(scan: PageScan): boolean {
  const top = scan.frames.find(({ index }) => index === 0);
  return scan.url.startsWith("chrome-error://") && PROXY_FAILURE.test(top?.text ?? "");
}

export function isDeadEnd(scan: PageScan): boolean {
  return DEAD_END.test(scan.frames.find(({ index }) => index === 0)?.text ?? "");
}

export interface ReadContext {
  /** The person has answered something, so a page with no form may mean they are in. */
  answered: boolean;
}

export function readStep(scan: PageScan, { answered }: ReadContext): LoginStep {
  if (scan.frames.some(({ captcha }) => captcha)) return { kind: "manual", reason: "captcha" };

  const forms = loginForms(scan);
  const form = forms.find(({ score, signUp }) => score >= LOGIN_FORM_SCORE && !signUp);
  if (form) return stepFromForm(form, scan);

  const decline = trustPrompt(scan);
  if (decline) return { kind: "trust", decline };

  const options = methodOptions(scan, null, null);
  const socialOnly = options.length > 0 && options.every(({ social }) => social);
  const signUp = forms.find((entry) => entry.signUp);
  const loginControl = findLoginControl(scan, signUp);

  if (allControls(scan).some(({ item }) => SIGNED_IN_CONTROL.test(item.text))) {
    if (answered) return { kind: "signed_in" };
  }
  if (loginControl && (signUp || !LOGIN_PLACE.test(scan.url))) {
    return { kind: "no_form", loginControl };
  }
  if (options.length > 0) {
    return socialOnly ? { kind: "manual", reason: "social" } : { kind: "choice", options };
  }
  if (scan.frames.some(({ text }) => PASSKEY.test(text))) {
    return { kind: "manual", reason: "passkey" };
  }
  if (!answered) return { kind: "no_form", loginControl };

  const asksMore = scan.frames.some(({ fields, url }) =>
    fields.some(({ filled, inDialog }) => !filled && (inDialog || LOGIN_PLACE.test(url))),
  );
  return asksMore ? { kind: "manual", reason: "unreadable" } : { kind: "signed_in" };
}
