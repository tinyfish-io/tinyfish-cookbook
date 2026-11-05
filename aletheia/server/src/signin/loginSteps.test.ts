import { describe, expect, it } from "vite-plus/test";

import type { LoginStep } from "./loginSteps.ts";
import { readStep } from "./loginSteps.ts";
import type { PageScan, ScannedControl, ScannedField, ScannedFrame } from "./pageScan.ts";

let nextRef = 0;

function field(rest: Partial<ScannedField>): ScannedField {
  nextRef += 1;
  return {
    ref: nextRef,
    type: "text",
    name: "",
    autocomplete: "",
    inputMode: "",
    label: "",
    maxLength: null,
    pattern: "",
    filled: false,
    form: 0,
    inDialog: false,
    dial: null,
    ...rest,
  };
}

function control(text: string, rest: Partial<ScannedControl> = {}): ScannedControl {
  nextRef += 1;
  return {
    ref: nextRef,
    text,
    kind: "button",
    submit: false,
    disabled: false,
    checked: false,
    form: 0,
    ...rest,
  };
}

function frame(rest: Partial<ScannedFrame> = {}): ScannedFrame {
  return {
    index: 0,
    url: "https://shop.test/login",
    text: "",
    errors: [],
    captcha: false,
    fields: [],
    controls: [],
    ...rest,
  };
}

const scan = (...frames: ScannedFrame[]): PageScan => ({
  url: frames[0]?.url ?? "https://shop.test/",
  frames,
});

const step = (page: PageScan, answered = false) => readStep(page, { answered });

function expectKind<K extends LoginStep["kind"]>(
  value: LoginStep,
  kind: K,
): Extract<LoginStep, { kind: K }> {
  expect(value.kind).toBe(kind);
  return value as Extract<LoginStep, { kind: K }>;
}

describe("readStep", () => {
  describe("identifier fields", () => {
    it.each([
      [{ type: "email" }, "email"],
      [{ autocomplete: "email" }, "email"],
      [{ inputMode: "email" }, "email"],
      [{ label: "E-mail address" }, "email"],
      [{ type: "tel" }, "phone"],
      [{ autocomplete: "tel" }, "phone"],
      [{ inputMode: "tel" }, "phone"],
      [{ type: "number", inputMode: "numeric", label: "Phone" }, "phone"],
      [{ label: "Mobile number" }, "phone"],
      [{ autocomplete: "username" }, "username"],
      [{ label: "Username" }, "username"],
      [{ autocomplete: "username", label: "Email" }, "email"],
      [{ label: "Email or mobile phone number" }, "email_or_phone"],
      [{ name: "phone_or_email" }, "email_or_phone"],
    ] as const)("reads %j as %s", (fieldTraits, accepts) => {
      const result = step(scan(frame({ fields: [field(fieldTraits)] })));

      expect(expectKind(result, "identifier").accepts).toBe(accepts);
    });

    it("presses the form's button right after an identifier when no password is showing", () => {
      const button = control("Continue", { submit: true });
      const result = step(scan(frame({ fields: [field({ type: "email" })], controls: [button] })));

      const identifier = expectKind(result, "identifier");
      expect(identifier.submitNow).toBe(true);
      expect(identifier.submit?.ref).toBe(button.ref);
    });

    it("skips a read-only way out of the form when picking the button", () => {
      const button = control("Send One Time Password", { submit: true });
      const forgot = control("Forgot password?", { kind: "link" });
      const result = step(
        scan(frame({ fields: [field({ type: "tel" })], controls: [forgot, button] })),
      );

      expect(expectKind(result, "identifier").submit?.ref).toBe(button.ref);
    });

    it("gets the country code from the site's own field when it shows one", () => {
      const fixed = field({ type: "tel", dial: { code: "+91", select: null } });
      const picker = field({ type: "tel", dial: { code: "+1", select: 77 } });

      expect(expectKind(step(scan(frame({ fields: [fixed] }))), "identifier").dial).toEqual({
        code: "+91",
        fixed: true,
        select: null,
      });
      expect(expectKind(step(scan(frame({ fields: [picker] }))), "identifier").dial).toEqual({
        code: "+1",
        fixed: false,
        select: { frame: 0, ref: 77 },
      });
    });
  });

  describe("the login form on a busy page", () => {
    it("takes the phone field in the login frame over the search boxes on the page", () => {
      const home = frame({
        url: "https://www.shop.test/bangalore",
        fields: [field({ label: "Search for restaurant" }), field({ label: "Delivery location" })],
        controls: [control("Log in")],
      });
      const auth = frame({
        index: 2,
        url: "https://accounts.shop.test/zoauth/login",
        fields: [field({ type: "number", label: "Phone" })],
        controls: [control("Send One Time Password", { submit: true })],
      });

      const result = expectKind(step(scan(home, auth)), "identifier");

      expect(result.accepts).toBe("phone");
      expect(result.field.frame).toBe(2);
    });

    it("does not take a newsletter box for a login", () => {
      const footer = frame({
        url: "https://shop.test/",
        fields: [field({ type: "email", label: "Your email" })],
        controls: [control("Subscribe", { submit: true }), control("Log in", { form: null })],
      });

      expect(step(scan(footer)).kind).toBe("no_form");
    });

    it("asks for the password when it shows beside a filled identifier", () => {
      const email = field({ type: "email", filled: true });
      const password = field({ type: "password" });
      const button = control("Sign in", { submit: true });

      const result = step(scan(frame({ fields: [email, password], controls: [button] })));

      const asked = expectKind(result, "password");
      expect(asked.field.ref).toBe(password.ref);
      expect(asked.submit?.ref).toBe(button.ref);
    });

    it("holds the button back for a password on the same page as the identifier", () => {
      const result = step(
        scan(
          frame({
            fields: [field({ type: "email" }), field({ type: "password" })],
            controls: [control("Sign in", { submit: true })],
          }),
        ),
      );

      expect(expectKind(result, "identifier").submitNow).toBe(false);
    });

    it("looks for a login link rather than filling in a sign-up form", () => {
      const login = control("Already have an account? Log in", { kind: "link" });
      const result = step(
        scan(
          frame({
            url: "https://shop.test/signup",
            fields: [
              field({ label: "Full name" }),
              field({ type: "email" }),
              field({ type: "password", autocomplete: "new-password" }),
            ],
            controls: [control("Create account", { submit: true }), login],
          }),
        ),
      );

      expect(expectKind(result, "no_form").loginControl?.ref).toBe(login.ref);
    });
  });

  describe("one-time codes", () => {
    it("reads a single field by its autocomplete, whatever its length", () => {
      const result = step(
        scan(
          frame({
            fields: [field({ autocomplete: "one-time-code", maxLength: 8 })],
            controls: [control("Verify", { submit: true })],
          }),
        ),
      );

      const code = expectKind(result, "code");
      expect(code.length).toBe(8);
      expect(code.digitsOnly).toBe(false);
    });

    it.each(["Enter OTP", "Verification code", "Authentication code", "6-digit passcode"])(
      "reads a field labelled %s",
      (label) => {
        expect(step(scan(frame({ fields: [field({ label })] }))).kind).toBe("code");
      },
    );

    it("takes a row of single-character boxes as one code, with the count as a hint", () => {
      const boxes = [1, 2, 3, 4].map(() => field({ maxLength: 1, inputMode: "numeric" }));

      const code = expectKind(step(scan(frame({ fields: boxes }))), "code");

      expect(code.fields.map(({ ref }) => ref)).toEqual(boxes.map(({ ref }) => ref));
      expect(code.length).toBe(4);
      expect(code.digitsOnly).toBe(true);
    });

    it.each(["Country code", "Promo code", "Zip code", "Postal code", "Gift code"])(
      "does not take %s for a one-time code",
      (label) => {
        const page = frame({
          url: "https://shop.test/",
          fields: [field({ label })],
          controls: [control("Apply", { submit: true })],
        });

        expect(step(scan(page)).kind).toBe("no_form");
      },
    );

    it("takes a code that mentions the phone it went to for a code", () => {
      const label = "Enter the code sent to your phone";

      expect(step(scan(frame({ fields: [field({ label })] }))).kind).toBe("code");
    });

    it("takes a phone field that mentions verification for a phone field", () => {
      const label = "Phone number for verification";

      expect(step(scan(frame({ fields: [field({ label })] }))).kind).toBe("identifier");
    });

    it("gives no length when the field does not say", () => {
      const code = expectKind(step(scan(frame({ fields: [field({ label: "Code" })] }))), "code");

      expect(code.length).toBeNull();
    });

    it("says where a texted code went, keeping only the end of the number", () => {
      const page = frame({
        text: "Verify your number\nWe sent a code to +91 ******4321\nEnter it below",
        fields: [field({ label: "Enter code" })],
      });

      const code = expectKind(step(scan(page)), "code");

      expect(code.channel).toBe("sms");
      expect(code.sentTo).toEqual({ kind: "phone", ending: "21" });
    });

    it("says where an emailed code went", () => {
      const page = frame({
        text: "Check your inbox\nWe emailed a code to r***@mail.test",
        fields: [field({ label: "Enter code" })],
      });

      const code = expectKind(step(scan(page)), "code");

      expect(code.channel).toBe("email");
      expect(code.sentTo).toEqual({ kind: "email", address: "r***@mail.test" });
    });

    it("knows an authenticator code", () => {
      const page = frame({
        text: "Two-step verification\nOpen your authenticator app",
        fields: [field({ label: "Enter code" })],
      });

      expect(expectKind(step(scan(page)), "code").channel).toBe("app");
    });

    it("finds the site's resend button, even while it counts down", () => {
      const ready = control("Resend code");
      const waiting = control("Resend code in 0:24", { disabled: true });
      const asked = [field({ label: "Enter OTP" })];

      const now = expectKind(step(scan(frame({ fields: asked, controls: [ready] }))), "code");
      const later = expectKind(step(scan(frame({ fields: asked, controls: [waiting] }))), "code");

      expect(now.resend).toEqual({ target: { frame: 0, ref: ready.ref }, ready: true });
      expect(later.resend?.ready).toBe(false);
    });

    it("never takes the resend button for the form's submit", () => {
      const resend = control("Send code again", { submit: true });
      const verify = control("Verify", { submit: true });

      const code = expectKind(
        step(scan(frame({ fields: [field({ label: "Code" })], controls: [resend, verify] }))),
        "code",
      );

      expect(code.submit?.ref).toBe(verify.ref);
    });
  });

  describe("choices", () => {
    it("mirrors the site's other ways in beside a form", () => {
      const email = control("Continue with Email", { form: null });
      const page = frame({
        fields: [field({ type: "tel" })],
        controls: [control("Send OTP", { submit: true }), email],
      });

      const { options } = expectKind(step(scan(page)), "identifier");

      expect(options).toEqual([
        expect.objectContaining({ label: "Continue with Email", social: false }),
      ]);
    });

    it("offers a social button beside a form, and marks it as one the person must finish", () => {
      const auth = frame({
        fields: [field({ type: "email" })],
        controls: [control("Continue", { submit: true })],
      });
      const google = frame({
        index: 3,
        url: "https://accounts.google.com/gsi/button",
        controls: [control("Sign in with Google", { form: null })],
      });

      const { options } = expectKind(step(scan(auth, google)), "identifier");

      expect(options).toEqual([
        expect.objectContaining({ label: "Sign in with Google", social: true }),
      ]);
    });

    it("asks when the page has nothing but method buttons", () => {
      const page = frame({
        text: "How should we send your code?",
        controls: [control("Text me"), control("Email me"), control("Forgot password?")],
      });

      const { options } = expectKind(step(scan(page)), "choice");

      expect(options.map(({ label }) => label)).toEqual(["Text me", "Email me"]);
    });

    it("does not take a page's other buttons for ways to sign in", () => {
      const page = frame({
        url: "https://shop.test/",
        controls: [control("Use current location"), control("Use coupon"), control("Log in")],
      });

      expect(step(scan(page)).kind).toBe("no_form");
    });

    it("keeps the labels the site uses", () => {
      const page = frame({
        controls: [control("Use password instead"), control("Email me a code")],
      });

      expect(expectKind(step(scan(page)), "choice").options.map(({ label }) => label)).toEqual([
        "Use password instead",
        "Email me a code",
      ]);
    });
  });

  describe("steps a form cannot do", () => {
    it("hands a captcha to the person, even with a form on the page", () => {
      const page = frame({ captcha: true, fields: [field({ type: "email" })] });

      expect(step(scan(page))).toEqual({ kind: "manual", reason: "captcha" });
    });

    it("hands over when the only way in is a social button", () => {
      const page = frame({ controls: [control("Continue with Google")] });

      expect(step(scan(page))).toEqual({ kind: "manual", reason: "social" });
    });

    it("counts a bare brand button as a social way in", () => {
      const page = frame({ controls: [control("Google")] });

      expect(step(scan(page))).toEqual({ kind: "manual", reason: "social" });
    });

    it("does not take a footer's follow links for a social sign-in", () => {
      const page = frame({
        url: "https://shop.test/missing",
        controls: [
          control("facebook", { kind: "link", form: null }),
          control("LinkedIn", { kind: "link", form: null }),
        ],
      });

      expect(step(scan(page))).toEqual({ kind: "no_form", loginControl: null });
    });

    it("hands over a passkey prompt", () => {
      const page = frame({ text: "Use your passkey to sign in" });

      expect(step(scan(page))).toEqual({ kind: "manual", reason: "passkey" });
    });

    it("hands over an extra form it cannot read after an answer", () => {
      const page = frame({ fields: [field({ label: "Date of birth" })] });

      expect(step(scan(page), true)).toEqual({ kind: "manual", reason: "unreadable" });
    });
  });

  describe("after signing in", () => {
    it("declines to trust a browser that is about to be deleted", () => {
      const no = control("Not now");
      const page = frame({
        text: "Trust this device?",
        controls: [control("Trust device"), no],
      });

      expect(expectKind(step(scan(page), true), "trust").decline.ref).toBe(no.ref);
    });

    it("unticks remember me and trust boxes on the form", () => {
      const box = control("Trust this device for 30 days", { kind: "checkbox", checked: true });
      const off = control("Remember me", { kind: "checkbox", checked: false });
      const page = frame({
        fields: [field({ label: "Enter code" })],
        controls: [box, off, control("Verify", { submit: true })],
      });

      expect(expectKind(step(scan(page)), "code").untick).toEqual([{ frame: 0, ref: box.ref }]);
    });

    it("sees an account menu as signed in", () => {
      const page = frame({ url: "https://shop.test/", controls: [control("Log out")] });

      expect(step(scan(page), true).kind).toBe("signed_in");
    });

    it("sees the form and the login button gone as signed in", () => {
      const page = frame({ url: "https://shop.test/home", controls: [control("Orders")] });

      expect(step(scan(page), true).kind).toBe("signed_in");
    });

    it("is not put off by the search box on the signed-in page", () => {
      const page = frame({
        url: "https://shop.test/home",
        fields: [field({ label: "Search for a dish" })],
        controls: [control("Orders")],
      });

      expect(step(scan(page), true).kind).toBe("signed_in");
    });

    it("does not call a page signed in before anything was answered", () => {
      const page = frame({ url: "https://shop.test/", controls: [control("Orders")] });

      expect(step(scan(page)).kind).toBe("no_form");
    });

    it("does not call a page signed in while it still offers to log in", () => {
      const login = control("Log in");
      const page = frame({ url: "https://shop.test/", controls: [login] });

      expect(expectKind(step(scan(page), true), "no_form").loginControl?.ref).toBe(login.ref);
    });
  });

  describe("finding the login", () => {
    it.each(["Log in", "Login", "Sign in", "Sign In / Register", "Log in or sign up", "Account"])(
      "follows a control called %s",
      (text) => {
        const login = control(text, { form: null });
        const page = frame({ url: "https://shop.test/", controls: [control("Deals"), login] });

        expect(expectKind(step(scan(page)), "no_form").loginControl?.ref).toBe(login.ref);
      },
    );

    it.each(["Log into your account", "Sign in to your account", "Sign into my account"])(
      "follows a link that names the account, like %s",
      (text) => {
        const login = control(text, { kind: "link", form: null });
        const page = frame({ url: "https://shop.test/", controls: [control("Plans"), login] });

        expect(expectKind(step(scan(page)), "no_form").loginControl?.ref).toBe(login.ref);
      },
    );

    it("prefers log in over a vaguer account link", () => {
      const account = control("My account", { form: null });
      const login = control("Sign in", { form: null });
      const page = frame({ url: "https://shop.test/", controls: [account, login] });

      expect(expectKind(step(scan(page)), "no_form").loginControl?.ref).toBe(login.ref);
    });

    it("reports nothing to follow on a page with no way in", () => {
      const page = frame({ url: "https://shop.test/", controls: [control("Get the app")] });

      expect(expectKind(step(scan(page)), "no_form").loginControl).toBeNull();
    });
  });
});
