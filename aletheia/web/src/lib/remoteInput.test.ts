import { describe, expect, it, vi } from "vite-plus/test";

import type { RemoteInput } from "./remoteInput.ts";
import { InputRelay, keyToInput, toRemotePoint } from "./remoteInput.ts";

const key = (overrides: Partial<Parameters<typeof keyToInput>[0]>) => ({
  key: "a",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  ...overrides,
});

describe("toRemotePoint", () => {
  it("scales a click on the shown image to the real page", () => {
    const point = toRemotePoint(
      { clientX: 150, clientY: 120 },
      { left: 100, top: 100, width: 200, height: 100 },
      { width: 1280, height: 640 },
    );
    expect(point).toEqual({ x: 320, y: 128 });
  });
});

describe("keyToInput", () => {
  it("sends a typed character as text", () => {
    expect(keyToInput(key({ key: "7" }))).toEqual({ kind: "text", text: "7" });
  });

  it("sends named keys by name", () => {
    expect(keyToInput(key({ key: "Enter" }))).toEqual({ kind: "key", key: "Enter" });
    expect(keyToInput(key({ key: "Backspace" }))).toEqual({ kind: "key", key: "Backspace" });
    expect(keyToInput(key({ key: "Tab" }))).toEqual({ kind: "key", key: "Tab" });
  });

  it("leaves browser shortcuts and bare modifiers alone", () => {
    expect(keyToInput(key({ key: "r", ctrlKey: true }))).toBeNull();
    expect(keyToInput(key({ key: "v", metaKey: true }))).toBeNull();
    expect(keyToInput(key({ key: "Shift" }))).toBeNull();
    expect(keyToInput(key({ key: "F5" }))).toBeNull();
  });

  it("keeps AltGr characters, which arrive with control and alt held", () => {
    expect(keyToInput(key({ key: "@", ctrlKey: true, altKey: true }))).toEqual({
      kind: "text",
      text: "@",
    });
  });

  it("stays out of the way of an input method", () => {
    expect(keyToInput(key({ key: "a", isComposing: true }))).toBeNull();
  });
});

function deferred() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

describe("InputRelay", () => {
  it("sends one at a time, so a slow request cannot reorder a code", async () => {
    const sent: RemoteInput[] = [];
    const gate = deferred();
    const send = vi.fn(async (input: RemoteInput) => {
      sent.push(input);
      await gate.promise;
    });
    const relay = new InputRelay(send, () => undefined);

    relay.push({ kind: "key", key: "Tab" });
    relay.push({ kind: "text", text: "1" });
    await settle();
    expect(send).toHaveBeenCalledTimes(1);

    gate.release();
    await settle();
    expect(sent).toEqual([
      { kind: "key", key: "Tab" },
      { kind: "text", text: "1" },
    ]);
  });

  it("joins text that piled up behind a slow request", async () => {
    const sent: RemoteInput[] = [];
    const gate = deferred();
    const relay = new InputRelay(
      async (input) => {
        sent.push(input);
        await gate.promise;
      },
      () => undefined,
    );

    relay.push({ kind: "key", key: "Tab" });
    relay.push({ kind: "text", text: "12" });
    relay.push({ kind: "text", text: "34" });
    gate.release();
    await settle();
    expect(sent.at(-1)).toEqual({ kind: "text", text: "1234" });
  });

  it("splits long pasted text to fit the server's limit", async () => {
    const sent: RemoteInput[] = [];
    const relay = new InputRelay(
      (input) => {
        sent.push(input);
        return Promise.resolve();
      },
      () => undefined,
    );

    relay.push({ kind: "text", text: "x".repeat(300) });
    await settle();
    expect(sent.map((input) => (input.kind === "text" ? input.text.length : 0))).toEqual([256, 44]);
  });

  it("adds up scrolling instead of queueing every wheel tick", async () => {
    const sent: RemoteInput[] = [];
    const gate = deferred();
    const relay = new InputRelay(
      async (input) => {
        sent.push(input);
        await gate.promise;
      },
      () => undefined,
    );

    relay.push({ kind: "click", x: 1, y: 1 });
    relay.push({ kind: "scroll", dx: 0, dy: 40 });
    relay.push({ kind: "scroll", dx: 0, dy: 60 });
    gate.release();
    await settle();
    expect(sent.at(-1)).toEqual({ kind: "scroll", dx: 0, dy: 100 });
  });

  it("drops what is waiting after a failure, so typing never lands out of order", async () => {
    const sent: RemoteInput[] = [];
    const gate = deferred();
    const onError = vi.fn();
    const relay = new InputRelay(async (input) => {
      sent.push(input);
      await gate.promise;
      throw new Error("gone");
    }, onError);

    relay.push({ kind: "text", text: "1" });
    relay.push({ kind: "key", key: "Enter" });
    gate.release();
    await settle();
    expect(sent).toHaveLength(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
