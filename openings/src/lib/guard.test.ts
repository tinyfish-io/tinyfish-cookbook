import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITS, clientKey, deepSearchAllowed, rateLimit, resetRateLimit } from "./guard";

test("rateLimit allows MAX_SCANS per window, then asks to wait", () => {
  resetRateLimit();
  const t0 = 1_000_000;
  for (let i = 0; i < LIMITS.MAX_SCANS; i++) assert.equal(rateLimit("ip", t0 + i).ok, true);
  const blocked = rateLimit("ip", t0 + 10);
  assert.equal(blocked.ok, false);
  assert.ok(!blocked.ok && blocked.retryAfter > 0);
  assert.equal(rateLimit("other-ip", t0 + 10).ok, true, "limits are per client");
  assert.equal(rateLimit("ip", t0 + LIMITS.WINDOW_MS + 1).ok, true, "window slides");
});

test("clientKey takes the first forwarded address", () => {
  const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
  assert.equal(clientKey(req), "203.0.113.7");
  assert.equal(clientKey(new Request("http://x")), "local");
});

test("deep search needs the passcode when one is configured", () => {
  const prev = process.env.DEEP_SEARCH_PASSCODE;
  process.env.DEEP_SEARCH_PASSCODE = "fish-123";
  try {
    assert.equal(deepSearchAllowed("fish-123"), true);
    assert.equal(deepSearchAllowed("wrong"), false);
    assert.equal(deepSearchAllowed(undefined), false);
  } finally {
    if (prev === undefined) delete process.env.DEEP_SEARCH_PASSCODE;
    else process.env.DEEP_SEARCH_PASSCODE = prev;
  }
});
