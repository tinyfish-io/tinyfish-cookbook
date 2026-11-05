import { describe, expect, it, vi } from "vite-plus/test";

import type { Frame } from "./loginBrowser.ts";
import { openLoginBrowser, PageActionError } from "./loginBrowser.ts";

type FrameEvent = { data: string; metadata: object; sessionId: number };

const { browser, emitFrame, setViewportSize, startScreencast } = vi.hoisted(() => {
  let onFrame: ((event: FrameEvent) => void) | undefined;
  const startScreencast = vi.fn();
  const cdp = {
    on: (_event: string, handler: (event: FrameEvent) => void) => {
      onFrame = handler;
    },
    send: (method: string) => {
      if (method === "Page.startScreencast") startScreencast();
      return Promise.resolve();
    },
    detach: () => Promise.resolve(),
  };
  const setViewportSize = vi.fn(() => Promise.resolve());
  const page = {
    url: () => "https://site.test/login",
    frames: () => [],
    mouse: {},
    keyboard: {},
    setViewportSize,
  };
  const context = {
    on: () => undefined,
    pages: () => [page],
    newCDPSession: () => Promise.resolve(cdp),
  };
  return {
    browser: { contexts: () => [context], close: () => Promise.resolve() },
    setViewportSize,
    startScreencast,
    emitFrame: () =>
      onFrame?.({ data: "abc", metadata: { deviceWidth: 390, deviceHeight: 780 }, sessionId: 1 }),
  };
});

vi.mock("playwright-core", () => ({
  chromium: { connectOverCDP: () => Promise.resolve(browser) },
}));

const FRAME: Frame = { data: "abc", width: 390, height: 780 };
const PHONE = { width: 390, height: 780 };

async function shown() {
  const login = await openLoginBrowser("wss://cdp.test");
  await login.showScreen(PHONE);
  return login;
}

describe("openLoginBrowser", () => {
  it("sends no frames until a step needs the person's own eyes", async () => {
    startScreencast.mockClear();

    await openLoginBrowser("wss://cdp.test");

    expect(startScreencast).not.toHaveBeenCalled();
  });

  it("sizes the page to the person's device for that step", async () => {
    await shown();

    expect(setViewportSize).toHaveBeenCalledWith(PHONE);
    expect(startScreencast).toHaveBeenCalled();
  });

  it("shows a new watcher the current page, which may not repaint for a while", async () => {
    const login = await shown();
    emitFrame();

    const seen: Frame[] = [];
    login.onFrame((frame) => seen.push(frame));

    expect(seen).toEqual([FRAME]);
  });

  it("keeps sending frames that arrive later", async () => {
    const login = await shown();
    const seen: Frame[] = [];
    login.onFrame((frame) => seen.push(frame));

    emitFrame();

    expect(seen).toEqual([FRAME]);
  });

  it("lets go of the last frame when the step is done, as it can show what was typed", async () => {
    const login = await shown();
    emitFrame();
    await login.hideScreen();

    const seen: Frame[] = [];
    login.onFrame((frame) => seen.push(frame));

    expect(seen).toEqual([]);
  });

  it("lets go of the last frame on close", async () => {
    const login = await shown();
    emitFrame();
    await login.close();

    const seen: Frame[] = [];
    login.onFrame((frame) => seen.push(frame));

    expect(seen).toEqual([]);
  });

  it("gives no detail when typing fails, as an error can quote what was typed", async () => {
    const login = await openLoginBrowser("wss://cdp.test");

    const error = await login
      .enter([{ frame: 0, ref: 0 }], "my-secret")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PageActionError);
    expect(String(error)).not.toContain("my-secret");
  });
});
