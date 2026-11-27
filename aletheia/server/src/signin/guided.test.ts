import { describe, expect, it, vi } from "vite-plus/test";

import type { LoginPage } from "./guided.ts";
import { COMMON_LOGIN_PATHS, GuidedLogin, phoneToType } from "./guided.ts";
import type { Target } from "./loginSteps.ts";
import type { PageScan, ScannedControl, ScannedField, ScannedFrame } from "./pageScan.ts";

function field(ref: number, rest: Partial<ScannedField>): ScannedField {
  return {
    ref,
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

function control(ref: number, text: string, rest: Partial<ScannedControl> = {}): ScannedControl {
  return {
    ref,
    text,
    kind: "button",
    submit: false,
    disabled: false,
    checked: false,
    form: 0,
    ...rest,
  };
}

function page(rest: Partial<ScannedFrame>): PageScan {
  const frame: ScannedFrame = {
    index: 0,
    url: "https://shop.test/login",
    text: "",
    errors: [],
    captcha: false,
    fields: [],
    controls: [],
    ...rest,
  };
  return { url: frame.url, frames: [frame] };
}

const EMAIL = field(1, { type: "email" });
const PASSWORD = field(2, { type: "password" });
const CODE = field(3, { label: "Enter code" });
const CONTINUE = control(10, "Continue", { submit: true });
const SIGN_IN = control(11, "Sign in", { submit: true });
const VERIFY = control(12, "Verify", { submit: true });
const RESEND = control(13, "Resend code");

const EMAIL_PAGE = page({ fields: [EMAIL], controls: [CONTINUE] });
const PASSWORD_PAGE = page({ fields: [PASSWORD], controls: [SIGN_IN] });
const CODE_PAGE = page({ fields: [CODE], controls: [VERIFY, RESEND] });
const HOME = page({ url: "https://shop.test/", controls: [control(20, "Log in")] });
const SIGNED_IN = page({ url: "https://shop.test/", controls: [control(21, "Log out")] });

/** A page that moves to its next scan when the script says so. */
function fakePage(scans: PageScan[]) {
  const script = [...scans];
  const advance = () => {
    if (script.length > 1) script.shift();
  };
  return {
    advance,
    scan: vi.fn(() => Promise.resolve(script[0] as PageScan)),
    goto: vi.fn((_url: string) => Promise.resolve()),
    click: vi.fn((_target: Target) => {
      advance();
      return Promise.resolve();
    }),
    enter: vi.fn((_fields: Target[], _text: string) => Promise.resolve()),
    pressEnter: vi.fn((_field: Target) => {
      advance();
      return Promise.resolve();
    }),
    choose: vi.fn((_select: Target, _code: string) => Promise.resolve()),
  } satisfies LoginPage & { advance: () => void };
}

function guided(pageFake: LoginPage, loginUrl: string | null = null) {
  return new GuidedLogin(pageFake, {
    url: "https://shop.test/",
    loginUrl,
    wait: () => Promise.resolve(),
    now: () => 0,
    settlePolls: 3,
  });
}

describe("phoneToType", () => {
  const dial = (rest: object = {}) => ({ code: null, fixed: false, select: null, ...rest });

  it("types the bare number when the site shows the code itself", () => {
    expect(
      phoneToType({ national: "98765 43210", dialCode: "+91" }, dial({ code: "+91" }), "tel"),
    ).toBe("9876543210");
  });

  it("adds the code when the site has no place for it", () => {
    expect(phoneToType({ national: "020 7946 0000", dialCode: "+44" }, dial(), "tel")).toBe(
      "+4402079460000",
    );
  });

  it("drops the plus for a number field, which cannot hold one", () => {
    expect(phoneToType({ national: "5550100", dialCode: "+1" }, dial(), "number")).toBe("15550100");
  });
});

describe("GuidedLogin", () => {
  describe("opening", () => {
    it("asks for the identifier when the page opens on a login form", async () => {
      const fake = fakePage([EMAIL_PAGE]);
      const login = guided(fake);

      const view = await login.open();

      expect(fake.goto).toHaveBeenCalledWith("https://shop.test/");
      expect(view).toMatchObject({ kind: "identifier", accepts: "email", error: null });
    });

    it("starts at the override's page when a site has one", async () => {
      const fake = fakePage([EMAIL_PAGE]);

      await guided(fake, "https://shop.test/city").open();

      expect(fake.goto).toHaveBeenCalledWith("https://shop.test/city");
    });

    it("presses the site's own Log in button to reach the form", async () => {
      const fake = fakePage([HOME, EMAIL_PAGE]);

      const view = await guided(fake).open();

      expect(fake.click).toHaveBeenCalledWith({ frame: 0, ref: 20 });
      expect(view.kind).toBe("identifier");
    });

    it("tries the usual login addresses when the page has no way in", async () => {
      const nothing = page({ url: "https://shop.test/" });
      const fake = fakePage([nothing]);
      fake.goto.mockImplementation((url) => {
        if (url.endsWith(COMMON_LOGIN_PATHS[1] ?? "")) fake.scan.mockResolvedValue(EMAIL_PAGE);
        return Promise.resolve();
      });

      const view = await guided(fake).open();

      expect(fake.goto).toHaveBeenCalledWith(`https://shop.test${COMMON_LOGIN_PATHS[0]}`);
      expect(view.kind).toBe("identifier");
    });

    it.each([
      "Sorry, you have been blocked. You are unable to access shop.test",
      "Access Denied. You don't have permission to access this server.",
      "404. Page not found",
      "Sorry, we couldn't find that page.",
    ])("moves on at once from a dead end that says %s", async (text) => {
      const fake = fakePage([page({ url: "https://shop.test/", text })]);
      fake.goto.mockImplementation((url) => {
        if (url.endsWith(COMMON_LOGIN_PATHS[0] ?? "")) fake.scan.mockResolvedValue(EMAIL_PAGE);
        return Promise.resolve();
      });
      const wait = vi.fn(() => Promise.resolve());
      const login = new GuidedLogin(fake, {
        url: "https://shop.test/",
        loginUrl: null,
        wait,
        now: () => 0,
        settlePolls: 3,
      });

      const view = await login.open();

      expect(view.kind).toBe("identifier");
      expect(wait).not.toHaveBeenCalled();
    });

    it("hands over when no login can be found", async () => {
      const view = await guided(fakePage([page({ url: "https://shop.test/" })])).open();

      expect(view).toMatchObject({ kind: "manual", reason: "unreadable" });
    });

    it("hands over a page that opens on a captcha", async () => {
      const view = await guided(fakePage([page({ captcha: true })])).open();

      expect(view).toMatchObject({ kind: "manual", reason: "captcha" });
    });
  });

  describe("answering", () => {
    it("types the answer into the site's field and presses its button", async () => {
      const fake = fakePage([EMAIL_PAGE, PASSWORD_PAGE]);
      const login = guided(fake);
      const { id } = await login.open();

      const view = await login.answer(id, { text: "me@mail.test" });

      expect(fake.enter).toHaveBeenCalledWith([{ frame: 0, ref: 1 }], "me@mail.test");
      expect(fake.click).toHaveBeenCalledWith({ frame: 0, ref: 10 });
      expect(view.kind).toBe("password");
    });

    it("presses Enter when a form has no button to find", async () => {
      const bare = page({ fields: [EMAIL], url: "https://shop.test/login" });
      const fake = fakePage([bare, PASSWORD_PAGE]);
      const login = guided(fake);
      const { id } = await login.open();

      await login.answer(id, { text: "me@mail.test" });

      expect(fake.pressEnter).toHaveBeenCalledWith({ frame: 0, ref: 1 });
    });

    it("types a password beside an identifier before pressing anything", async () => {
      const both = page({ fields: [EMAIL, PASSWORD], controls: [SIGN_IN] });
      const filled = page({
        fields: [{ ...EMAIL, filled: true }, PASSWORD],
        controls: [SIGN_IN],
      });
      const fake = fakePage([both, filled, SIGNED_IN]);
      fake.enter.mockImplementation(() => {
        fake.advance();
        return Promise.resolve();
      });
      const login = guided(fake);
      const { id } = await login.open();

      const asked = await login.answer(id, { text: "me@mail.test" });
      expect(asked.kind).toBe("password");
      expect(fake.click).not.toHaveBeenCalled();

      fake.enter.mockImplementation(() => Promise.resolve());
      const done = await login.answer(asked.id, { text: "hunter2" });

      expect(fake.click).toHaveBeenCalledWith({ frame: 0, ref: 11 });
      expect(done.kind).toBe("signed_in");
    });

    it("waits out a site that submits the code by itself", async () => {
      const fake = fakePage([CODE_PAGE, SIGNED_IN]);
      fake.enter.mockImplementation(() => {
        fake.advance();
        return Promise.resolve();
      });
      const login = guided(fake);
      const { id } = await login.open();

      const view = await login.answer(id, { text: "123456" });

      expect(fake.click).not.toHaveBeenCalled();
      expect(view.kind).toBe("signed_in");
    });

    it("shows the site's new error on the same question", async () => {
      const wrong = page({
        fields: [CODE],
        controls: [VERIFY, RESEND],
        errors: ["The code is wrong"],
      });
      const fake = fakePage([CODE_PAGE, wrong]);
      const login = guided(fake);
      const { id } = await login.open();

      const view = await login.answer(id, { text: "000000" });

      expect(view).toMatchObject({ kind: "code", error: "The code is wrong" });
    });

    it("says so when the site does nothing with an answer", async () => {
      const fake = fakePage([CODE_PAGE]);
      fake.click.mockImplementation(() => Promise.resolve());
      const login = guided(fake);
      const { id } = await login.open();

      const view = await login.answer(id, { text: "123456" });

      expect(view).toMatchObject({ kind: "code", error: null, stalled: true });
    });

    it("does not count words that were already on the page as an error", async () => {
      const standing = page({ fields: [EMAIL], controls: [CONTINUE], errors: ["Required"] });
      const fake = fakePage([standing, PASSWORD_PAGE]);
      const login = guided(fake);
      const { id } = await login.open();

      const view = await login.answer(id, { text: "me@mail.test" });

      expect(view.error).toBeNull();
    });

    it("drops an answer for a question the page has moved on from", async () => {
      const fake = fakePage([EMAIL_PAGE]);
      const login = guided(fake);
      const { id } = await login.open();

      const view = await login.answer(id + 1, { text: "late" });

      expect(fake.enter).not.toHaveBeenCalled();
      expect(view.id).toBe(id);
    });

    it("drops an answer when the site changed the question under it", async () => {
      const fake = fakePage([EMAIL_PAGE]);
      const login = guided(fake);
      const { id } = await login.open();
      fake.scan.mockResolvedValue(CODE_PAGE);

      const view = await login.answer(id, { text: "me@mail.test" });

      expect(fake.enter).not.toHaveBeenCalled();
      expect(view.kind).toBe("code");
    });

    it("picks the site's country code in its own select", async () => {
      const phone = field(4, { type: "tel", dial: { code: "+1", select: 50 } });
      const fake = fakePage([page({ fields: [phone], controls: [CONTINUE] }), CODE_PAGE]);
      const login = guided(fake);
      const { id } = await login.open();

      await login.answer(id, { text: "5550100", dialCode: "+44" });

      expect(fake.choose).toHaveBeenCalledWith({ frame: 0, ref: 50 }, "+44");
      expect(fake.enter).toHaveBeenCalledWith([{ frame: 0, ref: 4 }], "5550100");
    });

    it("unticks a ticked trust box before pressing the button", async () => {
      const box = control(30, "Trust this device", { kind: "checkbox", checked: true });
      const scan = page({ fields: [CODE], controls: [box, VERIFY] });
      const fake = fakePage([scan, SIGNED_IN]);
      fake.click.mockImplementationOnce(() => Promise.resolve());
      const login = guided(fake);
      const { id } = await login.open();

      await login.answer(id, { text: "123456" });

      expect(fake.click.mock.calls.map(([target]) => target.ref)).toEqual([30, 12]);
    });

    it("declines a trust prompt without asking", async () => {
      const prompt = page({
        url: "https://shop.test/2fa",
        text: "Trust this device?",
        controls: [control(40, "Trust"), control(41, "Not now")],
      });
      const fake = fakePage([CODE_PAGE, prompt, SIGNED_IN]);
      const login = guided(fake);
      const { id } = await login.open();

      const view = await login.answer(id, { text: "123456" });

      expect(fake.click).toHaveBeenCalledWith({ frame: 0, ref: 41 });
      expect(view.kind).toBe("signed_in");
    });

    it("never carries what was typed in a view", async () => {
      const fake = fakePage([EMAIL_PAGE, PASSWORD_PAGE]);
      const login = guided(fake);
      const { id } = await login.open();

      const view = await login.answer(id, { text: "secret-value" });

      expect(JSON.stringify(view)).not.toContain("secret-value");
    });
  });

  describe("the site's other buttons", () => {
    it("follows a choice by its label", async () => {
      const choose = page({
        url: "https://shop.test/method",
        controls: [control(60, "Text me"), control(61, "Email me")],
      });
      const fake = fakePage([choose, CODE_PAGE]);
      const login = guided(fake);
      const view = await login.open();

      const next = await login.choose(view.options?.[1]?.id ?? "");

      expect(fake.click).toHaveBeenCalledWith({ frame: 0, ref: 61 });
      expect(next.kind).toBe("code");
    });

    it("hands over after a social button, which opens someone else's page", async () => {
      const both = page({
        fields: [EMAIL],
        controls: [CONTINUE, control(62, "Continue with Google")],
      });
      const fake = fakePage([both, both]);
      const login = guided(fake);
      const view = await login.open();

      const next = await login.choose(view.options?.[0]?.id ?? "");

      expect(next).toMatchObject({ kind: "manual", reason: "social" });
    });

    it("presses the site's resend button and stays on the question", async () => {
      const fake = fakePage([CODE_PAGE]);
      fake.click.mockImplementation(() => Promise.resolve());
      const login = guided(fake);
      await login.open();

      const view = await login.resend();

      expect(fake.click).toHaveBeenCalledWith({ frame: 0, ref: 13 });
      expect(view).toMatchObject({ kind: "code", resend: "ready" });
    });

    it("goes back to the login page to start again", async () => {
      const fake = fakePage([EMAIL_PAGE]);
      const login = guided(fake);
      await login.open();
      fake.goto.mockClear();

      await login.restart();

      expect(fake.goto).toHaveBeenCalledWith("https://shop.test/");
    });
  });

  describe("handing over and coming back", () => {
    it("lets a person ask for the page at any step", async () => {
      const login = guided(fakePage([EMAIL_PAGE]));
      await login.open();

      expect(login.handOver()).toMatchObject({ kind: "manual", reason: "asked" });
    });

    it("picks up the guided form after the person solves a captcha", async () => {
      const fake = fakePage([page({ captcha: true })]);
      const login = guided(fake);
      await login.open();
      fake.scan.mockResolvedValue(EMAIL_PAGE);

      const view = await login.resume();

      expect(view.kind).toBe("identifier");
    });

    it("stays on the page while the captcha is still there", async () => {
      const fake = fakePage([page({ captcha: true })]);
      const login = guided(fake);
      await login.open();

      expect(await login.resume()).toMatchObject({ kind: "manual", reason: "captcha" });
    });

    it("takes the person's word that they are in when no form is left", async () => {
      const fake = fakePage([page({ captcha: true })]);
      const login = guided(fake);
      await login.open();
      fake.scan.mockResolvedValue(page({ url: "https://shop.test/" }));

      expect((await login.resume()).kind).toBe("signed_in");
    });
  });

  it("keeps resend up to date while the question stays the same", async () => {
    const counting = page({
      fields: [CODE],
      controls: [VERIFY, control(13, "Resend code in 0:20", { disabled: true })],
    });
    const fake = fakePage([counting]);
    const login = guided(fake);
    const first = await login.open();
    fake.scan.mockResolvedValue(CODE_PAGE);

    const view = await login.refresh();

    expect(first).toMatchObject({ resend: "waiting" });
    expect(view).toMatchObject({ resend: "ready" });
  });
});
