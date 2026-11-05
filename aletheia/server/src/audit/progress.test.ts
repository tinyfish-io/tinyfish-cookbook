import { describe, expect, it } from "vite-plus/test";

import { isWritingUp } from "./progress.ts";

const EXPECTED_BY = "2026-11-04T17:38:30.000Z";
const BEFORE = new Date("2026-11-04T17:37:20.000Z");
const AFTER = new Date("2026-11-04T17:39:30.000Z");

describe("isWritingUp", () => {
  it.each([
    "Report findings and finish task due to budget exhaustion",
    "Task stopped at contact_required - site needs email/phone to proceed",
    "Summarise what the checkout showed",
  ])("reads a quiet spell after %s as the write-up", (step) => {
    expect(isWritingUp(step, BEFORE, EXPECTED_BY)).toBe(true);
  });

  it("keeps a slow page early in the run as running", () => {
    expect(
      isWritingUp("Go to laptop search results page without filters", BEFORE, EXPECTED_BY),
    ).toBe(false);
  });

  it("reads any quiet spell past the expected end as the write-up", () => {
    expect(
      isWritingUp("Go to laptop search results page without filters", AFTER, EXPECTED_BY),
    ).toBe(true);
  });

  it("goes by the words alone when no end is known", () => {
    expect(isWritingUp(undefined, AFTER, null)).toBe(false);
    expect(isWritingUp("Report the findings", AFTER, null)).toBe(true);
  });
});
