import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { recallSignIn, rememberSignIn } from "./signInMemory.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("sign-in memory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds the sign-in used for a site in an audit", () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    rememberSignIn("a1", "https://a.test/", "signin-1");
    expect(recallSignIn("a1", "https://a.test/")).toBe("signin-1");
    expect(recallSignIn("a1", "https://b.test/")).toBeNull();
  });

  it("survives a browser that blocks storage", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => rememberSignIn("a1", "https://a.test/", "signin-1")).not.toThrow();
    expect(recallSignIn("a1", "https://a.test/")).toBeNull();
  });
});
