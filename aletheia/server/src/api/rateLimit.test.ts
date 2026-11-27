import { describe, expect, it } from "vite-plus/test";

import { RateLimiter } from "./rateLimit.ts";

describe("RateLimiter", () => {
  it("allows up to the limit within the window", () => {
    const limiter = new RateLimiter(3, 1000, () => 0);

    expect(limiter.take("a", 2)).toBe(true);
    expect(limiter.take("a", 1)).toBe(true);
    expect(limiter.take("a", 1)).toBe(false);
  });

  it("takes nothing from a request it refuses", () => {
    const limiter = new RateLimiter(3, 1000, () => 0);

    expect(limiter.take("a", 4)).toBe(false);
    expect(limiter.take("a", 3)).toBe(true);
  });

  it("tracks each key on its own", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);

    expect(limiter.take("a", 1)).toBe(true);
    expect(limiter.take("b", 1)).toBe(true);
  });

  it("frees capacity once the window has passed", () => {
    let time = 0;
    const limiter = new RateLimiter(1, 1000, () => time);

    limiter.take("a", 1);
    time = 1001;

    expect(limiter.take("a", 1)).toBe(true);
  });

  it("can check two limits without spending on either when one refuses", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);

    expect(limiter.has("a", 1)).toBe(true);
    limiter.take("a", 1);
    expect(limiter.has("a", 1)).toBe(false);
  });
});
