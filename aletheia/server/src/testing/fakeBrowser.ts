import { vi } from "vite-plus/test";

import type { Frame, LoginBrowser } from "../signin/loginBrowser.ts";
import type { Target } from "../signin/loginSteps.ts";
import type { PageScan, ScannedControl, ScannedField, ScannedFrame } from "../signin/pageScan.ts";

export function scanField(ref: number, rest: Partial<ScannedField> = {}): ScannedField {
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

export function scanControl(
  ref: number,
  text: string,
  rest: Partial<ScannedControl> = {},
): ScannedControl {
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

export function scanPage(rest: Partial<ScannedFrame>): PageScan {
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

export const EMAIL_PAGE = scanPage({
  fields: [scanField(1, { type: "email" })],
  controls: [scanControl(10, "Continue", { submit: true })],
});
export const SIGNED_IN_PAGE = scanPage({
  url: "https://shop.test/",
  controls: [scanControl(21, "Log out")],
});

/** A login browser whose page moves to the next scan on each click or Enter. */
export function fakeBrowser(scans: PageScan[] = [EMAIL_PAGE, SIGNED_IN_PAGE]) {
  const script = [...scans];
  const advance = () => {
    if (script.length > 1) script.shift();
    return Promise.resolve();
  };
  let listener: ((frame: Frame) => void) | undefined;

  return {
    advance,
    emit: (frame: Frame) => listener?.(frame),
    scan: vi.fn(() => Promise.resolve(script[0] as PageScan)),
    goto: vi.fn((_url: string) => Promise.resolve()),
    click: vi.fn((_target: Target) => advance()),
    enter: vi.fn((_fields: Target[], _text: string) => Promise.resolve()),
    pressEnter: vi.fn((_field: Target) => advance()),
    choose: vi.fn((_select: Target, _code: string) => Promise.resolve()),
    showScreen: vi.fn((_viewport: { width: number; height: number }) => Promise.resolve()),
    hideScreen: vi.fn(() => Promise.resolve()),
    onFrame: (fn: (frame: Frame) => void) => {
      listener = fn;
      return () => {
        listener = undefined;
      };
    },
    tap: vi.fn((_x: number, _y: number) => Promise.resolve()),
    press: vi.fn((_key: string) => Promise.resolve()),
    type: vi.fn((_text: string) => Promise.resolve()),
    scroll: vi.fn((_dx: number, _dy: number) => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  } satisfies LoginBrowser & { advance: () => Promise<void>; emit: (frame: Frame) => void };
}
