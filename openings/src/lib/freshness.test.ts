import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SEEN, isStale, markNew } from "./freshness";

test("first scan marks nothing as new but remembers everything", () => {
  const { newIds, seen } = markNew({}, ["a", "b"], "2026-09-29T10:00:00Z");
  assert.deepEqual(newIds, []);
  assert.deepEqual(Object.keys(seen).sort(), ["a", "b"]);
});

test("later scans mark only unseen jobs as new and keep first-seen times", () => {
  const first = markNew({}, ["a", "b"], "2026-09-29T10:00:00Z").seen;
  const { newIds, seen } = markNew(first, ["b", "c"], "2026-09-30T10:00:00Z");
  assert.deepEqual(newIds, ["c"]);
  assert.equal(seen.b, "2026-09-29T10:00:00Z", "first sighting is not overwritten");
  assert.equal(seen.c, "2026-09-30T10:00:00Z");
  assert.ok("a" in seen, "jobs missing from this scan are still remembered");
});

test("history is capped, dropping the oldest sightings", () => {
  const seen = Object.fromEntries(Array.from({ length: MAX_SEEN }, (_, i) => [`old${i}`, "2026-01-01T00:00:00Z"]));
  const out = markNew(seen, ["fresh"], "2026-09-29T00:00:00Z");
  assert.equal(Object.keys(out.seen).length, MAX_SEEN);
  assert.ok("fresh" in out.seen);
  assert.deepEqual(out.newIds, ["fresh"]);
});

test("isStale after a day", () => {
  const now = new Date("2026-09-30T12:00:00Z").getTime();
  assert.equal(isStale("2026-09-30T00:00:00Z", now), false);
  assert.equal(isStale("2026-09-29T11:00:00Z", now), true);
});
