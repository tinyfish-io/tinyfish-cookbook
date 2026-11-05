import { describe, expect, it } from "vite-plus/test";

import { DIAL_CODES, dialChoices, visitorDialCode } from "./dialCodes.ts";
import {
  cleanCode,
  codeNote,
  errorLine,
  manualCopy,
  question,
  viewportForScreen,
} from "./signInCopy.ts";
import type { StepView } from "./types.ts";

const base = { id: 1, error: null };
const identifier = (accepts: Extract<StepView, { kind: "identifier" }>["accepts"]): StepView => ({
  ...base,
  kind: "identifier",
  accepts,
  dial: { code: null, fixed: false },
});
const code = (
  rest: Partial<Extract<StepView, { kind: "code" }>> = {},
): Extract<StepView, { kind: "code" }> => ({
  ...base,
  kind: "code",
  length: null,
  digitsOnly: false,
  channel: null,
  sentTo: null,
  resend: "none",
  ...rest,
});

describe("question", () => {
  it.each([
    ["phone", "Zomato wants your phone number"],
    ["email", "Zomato wants your email"],
    ["username", "Zomato wants your username"],
    ["email_or_phone", "Zomato wants your email or phone number"],
  ] as const)("asks for %s by name", (accepts, words) => {
    expect(question(identifier(accepts), "Zomato")).toBe(words);
  });

  it("names the site in the password question", () => {
    expect(question({ ...base, kind: "password" }, "Adobe")).toBe("Enter your Adobe password");
  });

  it("says which number the code went to", () => {
    const step = code({ sentTo: { kind: "phone", ending: "21" }, channel: "sms" });

    expect(question(step, "Zomato")).toBe("Enter the code Zomato sent to the number ending 21");
  });

  it("says which address the code went to", () => {
    const step = code({ sentTo: { kind: "email", address: "r***@mail.test" }, channel: "email" });

    expect(question(step, "Adobe")).toBe("Enter the code Adobe sent to r***@mail.test");
  });

  it.each([
    ["sms", "Enter the code Shop texted you"],
    ["email", "Enter the code Shop emailed you"],
    ["app", "Enter the code from your authenticator app"],
    [null, "Enter the code Shop sent you"],
  ] as const)("words a %s code without a known address", (channel, words) => {
    expect(question(code({ channel }), "Shop")).toBe(words);
  });

  it("asks how to sign in when the site offers a choice", () => {
    expect(question({ ...base, kind: "choice" }, "Shop")).toBe(
      "How do you want to sign in to Shop?",
    );
  });
});

describe("codeNote", () => {
  it("uses the site's boxes only as a hint", () => {
    expect(codeNote(code({ length: 6 }))).toBe("Usually 6 characters.");
  });

  it("says nothing when the site does not say", () => {
    expect(codeNote(code())).toBeNull();
  });
});

describe("cleanCode", () => {
  it("drops the spaces and dashes a pasted code can carry", () => {
    expect(cleanCode(" 123 456\n")).toBe("123456");
    expect(cleanCode("AB-12-CD")).toBe("AB12CD");
  });

  it("keeps letters, in their case", () => {
    expect(cleanCode("aB3dE9")).toBe("aB3dE9");
  });
});

describe("errorLine", () => {
  it("puts a wrong code in plain words", () => {
    expect(errorLine(code({ error: "Incorrect OTP entered. Try again" }), "Zomato")).toBe(
      "Zomato says the code is wrong.",
    );
  });

  it("puts a wrong password in plain words", () => {
    const step: StepView = { ...base, kind: "password", error: "Invalid password." };

    expect(errorLine(step, "Adobe")).toBe("Adobe says the password is wrong.");
  });

  it("passes any other error on as the site put it", () => {
    const step: StepView = { ...base, kind: "password", error: "Account locked for 10 minutes" };

    expect(errorLine(step, "Shop")).toBe("Shop says: Account locked for 10 minutes");
  });

  it("says so when the site did nothing", () => {
    expect(errorLine(code({ stalled: true }), "Shop")).toBe(
      "Shop did not respond. Please try again.",
    );
  });

  it("has nothing to say when all is well", () => {
    expect(errorLine(code(), "Shop")).toBeNull();
  });
});

describe("manualCopy", () => {
  it.each(["captcha", "social", "passkey", "unreadable", "asked"] as const)(
    "gives a heading and a line for %s",
    (reason) => {
      const { title, body } = manualCopy(reason, "Shop");

      expect(title).toContain("Shop");
      expect(body.length).toBeGreaterThan(0);
    },
  );
});

describe("viewportForScreen", () => {
  it("takes the room left around the bars on a phone", () => {
    expect(viewportForScreen({ width: 390, height: 844 })).toEqual({ width: 390, height: 620 });
  });

  it("stays within a laptop's size on a big screen", () => {
    expect(viewportForScreen({ width: 2560, height: 1440 })).toEqual({ width: 1280, height: 800 });
  });

  it("never asks for less than the server allows", () => {
    expect(viewportForScreen({ width: 200, height: 300 })).toEqual({ width: 240, height: 240 });
  });
});

describe("dial codes", () => {
  it("defaults to the visitor's country", () => {
    expect(visitorDialCode("IN", ["en-US"])).toBe("+91");
  });

  it("falls back on the browser's language", () => {
    expect(visitorDialCode(null, ["en-GB"])).toBe("+44");
  });

  it("falls back on a default for a language with no region", () => {
    expect(visitorDialCode(null, ["en"])).toBe("+1");
  });

  it("offers one choice per code, named and sorted", () => {
    const choices = dialChoices();
    const india = choices.find(({ code: dial }) => dial === "+91");

    expect(india?.label).toBe("India +91");
    expect(new Set(choices.map(({ label }) => label)).size).toBe(choices.length);
    expect(choices.map(({ label }) => label)).toEqual(
      choices.map(({ label }) => label).toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it("holds well-formed codes only", () => {
    for (const dial of Object.values(DIAL_CODES)) expect(dial).toMatch(/^\+\d{1,4}$/);
  });
});
