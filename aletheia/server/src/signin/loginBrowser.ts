import type {
  CDPSession,
  ElementHandle,
  Frame as PageFrame,
  JSHandle,
  Page,
} from "playwright-core";
import { chromium } from "playwright-core";

import type { LoginPage } from "./guided.ts";
import type { Target } from "./loginSteps.ts";
import type { FrameScan, PageScan, ScannedFrame } from "./pageScan.ts";
import { scanDocument } from "./pageScan.ts";

export interface Frame {
  /** A base64 JPEG. */
  data: string;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** The live page, for the one step a person has to do themselves. */
export interface RemoteScreen {
  onFrame(listener: (frame: Frame) => void): () => void;
  tap(x: number, y: number): Promise<void>;
  press(key: string): Promise<void>;
  type(text: string): Promise<void>;
  scroll(dx: number, dy: number): Promise<void>;
}

export interface LoginBrowser extends LoginPage, RemoteScreen {
  showScreen(viewport: Viewport): Promise<void>;
  hideScreen(): Promise<void>;
  close(): Promise<void>;
}

export type OpenBrowser = (cdpUrl: string) => Promise<LoginBrowser>;

/**
 * Never carries a cause: a Playwright error can quote its call, and the call here holds what a
 * person typed.
 */
export class PageActionError extends Error {
  constructor() {
    super("The page did not take that action.");
    this.name = "PageActionError";
  }
}

const NAVIGATION_TIMEOUT_MS = 45_000;
const CLICK_TIMEOUT_MS = 4000;
const SCAN_TIMEOUT_MS = 4000;
const TYPE_DELAY_MS = 45;
const MAX_FRAMES = 14;

type HeldFrame = JSHandle<{ scan: FrameScan; elements: Element[] }>;

function withinTime<T>(work: Promise<T>): Promise<T | null> {
  return Promise.race([
    work.catch(() => null),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), SCAN_TIMEOUT_MS).unref();
    }),
  ]);
}

/**
 * Drives the setup browser for one sign-in. Typed values pass through as arguments and are never
 * kept, and frames flow only while `showScreen` is on, because a frame can show what was typed.
 */
export const openLoginBrowser: OpenBrowser = async (cdpUrl) => {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const listeners = new Set<(frame: Frame) => void>();
  const held = new Map<number, HeldFrame>();

  let page: Page = context.pages()[0] ?? (await context.newPage());
  let session: CDPSession | undefined;
  let latest: Frame | undefined;
  let screenOn = false;

  const stopFrames = async () => {
    await session?.detach().catch(() => undefined);
    session = undefined;
  };

  const startFrames = async (target: Page) => {
    await stopFrames();
    const cdp = await context.newCDPSession(target);
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      const frame = { data, width: metadata.deviceWidth, height: metadata.deviceHeight };
      latest = frame;
      for (const listener of listeners) listener(frame);
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60 });
    session = cdp;
  };

  const usePage = (next: Page) => {
    page = next;
    if (screenOn) startFrames(next).catch(() => undefined);
  };

  // Sign-in with Google and the like opens a popup, and the person needs to see that instead.
  context.on("page", (popup) => {
    usePage(popup);
    popup.on("close", () => {
      const last = context.pages().at(-1);
      if (last) usePage(last);
    });
  });

  async function element(target: Target): Promise<ElementHandle> {
    const elements = await held.get(target.frame)?.getProperty("elements");
    const found = (await elements?.getProperty(String(target.ref)))?.asElement();
    if (!found) throw new PageActionError();
    return found as ElementHandle;
  }

  async function scanFrame(frame: PageFrame, index: number): Promise<ScannedFrame | null> {
    const handle = await withinTime(frame.evaluateHandle(scanDocument));
    if (!handle) return null;
    const scan = await withinTime(handle.evaluate((result) => result.scan));
    if (!scan) return null;
    held.set(index, handle);
    return { ...scan, index };
  }

  async function focused(input: ElementHandle): Promise<void> {
    await input.click({ timeout: CLICK_TIMEOUT_MS }).catch(() => input.focus());
  }

  const valueLength = (input: ElementHandle) =>
    input.evaluate((node) => (node as HTMLInputElement).value.length);

  async function enterOne(input: ElementHandle, text: string): Promise<void> {
    await focused(input);
    await input.fill("").catch(() => undefined);
    await page.keyboard.type(text, { delay: TYPE_DELAY_MS });
    if ((await valueLength(input)) === 0) await input.fill(text);
  }

  async function enterAcross(boxes: ElementHandle[], text: string): Promise<void> {
    const [first] = boxes;
    if (!first) return;
    await focused(first);
    await page.keyboard.type(text, { delay: TYPE_DELAY_MS });

    // Boxes that do not move the cursor themselves take one character each.
    const last = boxes[Math.min(text.length, boxes.length) - 1];
    if (last && (await valueLength(last)) > 0) return;
    for (const [index, box] of boxes.entries()) {
      await box.fill(text.charAt(index));
    }
  }

  return {
    async scan(): Promise<PageScan> {
      const frames = page.frames().slice(0, MAX_FRAMES);
      const previous = [...held.values()];
      held.clear();
      const scans = await Promise.all(frames.map(scanFrame));
      for (const handle of previous) handle.dispose().catch(() => undefined);
      return { url: page.url(), frames: scans.filter((scan) => scan !== null) };
    },

    async goto(url) {
      await page
        .goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS })
        .catch(() => undefined);
    },

    async click(target) {
      const control = await element(target);
      await control.click({ timeout: CLICK_TIMEOUT_MS }).catch(async () => {
        // A cookie banner can sit over the button, which a direct click gets past. A click that
        // started a navigation tears the page down under this, which means it worked.
        await control.evaluate((node) => (node as HTMLElement).click()).catch(() => undefined);
      });
    },

    async enter(fields, text) {
      try {
        const inputs = await Promise.all(fields.map(element));
        const [only] = inputs;
        if (only && inputs.length === 1) await enterOne(only, text);
        else await enterAcross(inputs, text);
      } catch {
        throw new PageActionError();
      }
    },

    async pressEnter(field) {
      const input = await element(field);
      await input.press("Enter");
    },

    async choose(select, dialCode) {
      const picker = await element(select);
      await picker.evaluate((node, code) => {
        const list = node as HTMLSelectElement;
        const match = [...list.options].find((option) => option.text.includes(code));
        if (!match) return;
        list.value = match.value;
        list.dispatchEvent(new Event("change", { bubbles: true }));
      }, dialCode);
    },

    async showScreen(viewport) {
      screenOn = true;
      await page.setViewportSize(viewport).catch(() => undefined);
      await startFrames(page);
    },

    async hideScreen() {
      screenOn = false;
      latest = undefined;
      await stopFrames();
    },

    // Chrome only sends a frame on repaint, so a still page would stay blank for a late watcher.
    onFrame(listener) {
      listeners.add(listener);
      if (latest) listener(latest);
      return () => listeners.delete(listener);
    },
    tap: (x, y) => page.mouse.click(x, y),
    press: (key) => page.keyboard.press(key),
    type: (text) => page.keyboard.insertText(text),
    scroll: (dx, dy) => page.mouse.wheel(dx, dy),

    async close() {
      listeners.clear();
      latest = undefined;
      held.clear();
      await browser.close().catch(() => undefined);
    },
  };
};
