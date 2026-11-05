import { describe, expect, it } from "vite-plus/test";

import { bill, finding, report } from "../testing/report.ts";
import {
  billLines,
  counts,
  logoutNote,
  orderedPatterns,
  patternGroups,
  severityLevel,
  severityLine,
  signInOffer,
  stopSummary,
  olderAuditNote,
  tallyLine,
} from "./report.ts";
import { PATTERN_IDS } from "./types.ts";

describe("tallyLine", () => {
  it("says what was found and what was not checked", () => {
    expect(tallyLine({ found: 1, notChecked: 4 })).toBe("1 found, 4 not checked");
  });

  it("leaves out not checked when every pattern was checked", () => {
    expect(tallyLine({ found: 2, notChecked: 0 })).toBe("2 found");
  });

  it("still says so when nothing was found", () => {
    expect(tallyLine({ found: 0, notChecked: 3 })).toBe("0 found, 3 not checked");
  });
});

describe("orderedPatterns", () => {
  it("puts found first, the most serious ahead, and clean rows last", () => {
    const rows = orderedPatterns(
      report({
        patterns: [
          finding({ id: "nagging", label: "Nagging", status: "found" }),
          finding({
            id: "drip_pricing",
            label: "Drip pricing",
            severity: "high",
            status: "found",
          }),
          finding({ id: "trick_question", label: "Trick question", status: "not_checked" }),
        ],
      }),
    );
    expect(rows).toHaveLength(PATTERN_IDS.length);
    expect(rows.slice(0, 3).map((row) => row.id)).toEqual([
      "drip_pricing",
      "nagging",
      "trick_question",
    ]);
    expect(rows.at(-1)?.status).toBe("not_found");
  });
});

describe("severityLevel", () => {
  it("names each level in words, beside a meter of the same weight", () => {
    expect(severityLevel("high")).toEqual({ text: "High", bars: 3 });
    expect(severityLevel("medium")).toEqual({ text: "Medium", bars: 2 });
    expect(severityLevel("low")).toEqual({ text: "Low", bars: 1 });
  });
});

describe("severityLine", () => {
  it("leads with the worst findings named", () => {
    const line = severityLine(
      report({
        patterns: [
          finding({ id: "drip_pricing", label: "Drip pricing", severity: "high", status: "found" }),
          finding({ id: "countdown", status: "found" }),
        ],
      }),
    );
    expect(line).toBe(
      "1 high, 1 medium: fees added after the first price and a countdown or deadline",
    );
  });

  it("is empty when nothing was found", () => {
    expect(severityLine(report())).toBeNull();
  });
});

describe("patternGroups", () => {
  const mixed = (flow: "checkout" | "subscription") =>
    report({
      flow,
      patterns: [
        finding({ id: "nagging", status: "found" }),
        finding({ id: "hard_to_cancel", status: "not_applicable" }),
        finding({ id: "cancellation_fee", status: "not_applicable" }),
        finding({ id: "drip_pricing", status: "not_checked" }),
      ],
    });

  it("keeps the patterns that cannot apply out of the main list", () => {
    const { checked, notApplicable } = patternGroups(mixed("checkout"));

    expect(checked.map((row) => row.status)).not.toContain("not_applicable");
    expect(checked[0]?.id).toBe("nagging");
    expect(notApplicable.map((row) => row.id).toSorted()).toEqual([
      "cancellation_fee",
      "hard_to_cancel",
    ]);
  });

  it("names the flow they cannot apply to", () => {
    expect(patternGroups(mixed("checkout")).heading).toBe("Doesn't apply to a one-off purchase");
    expect(patternGroups(mixed("subscription")).heading).toBe(
      "Doesn't apply to a subscription sign-up",
    );
  });
});

describe("counts", () => {
  it("adds up each status", () => {
    const summary = counts(
      report({
        patterns: [
          finding({ id: "nagging", status: "found" }),
          finding({ id: "drip_pricing", status: "not_checked" }),
          finding({ id: "hard_to_cancel", status: "not_applicable" }),
        ],
      }),
    );
    expect(summary).toEqual({
      found: 1,
      notChecked: 1,
      notFound: PATTERN_IDS.length - 3,
      notApplicable: 1,
    });
  });
});

describe("billLines", () => {
  it("marks fees that appeared after the first price with their step", () => {
    const lines = billLines(
      bill({
        firstPrice: 52,
        firstPriceStep: 2,
        firstPriceSource: "product_page",
        charges: [
          { name: "Delivery charge", amount: 25, firstSeenAtStep: 3 },
          { name: "Handling charge", amount: 2, firstSeenAtStep: 2 },
        ],
        total: 79,
      }),
    );
    expect(lines).toEqual([
      {
        label: "Price on the product page",
        amount: 52,
        sign: "base",
        step: 2,
        late: false,
        tag: null,
      },
      { label: "Delivery charge", amount: 25, sign: "plus", step: 3, late: true, tag: null },
      { label: "Handling charge", amount: 2, sign: "plus", step: 2, late: false, tag: null },
    ]);
  });

  it("starts from the items total when the cart holds more than the first price", () => {
    const [first] = billLines(bill({ firstPrice: 52, itemsTotal: 104, total: 104 }));
    expect(first).toMatchObject({ label: "Items in the cart", amount: 104 });
  });

  it("flags extras and subtracts discounts", () => {
    const lines = billLines(
      bill({
        firstPrice: 100,
        firstPriceStep: 1,
        extras: [{ name: "Tip", amount: 20, firstSeenAtStep: 3 }],
        discounts: [{ name: "Coupon", amount: 10, firstSeenAtStep: 3 }],
      }),
    );
    expect(lines[1]).toMatchObject({ label: "Tip", sign: "plus", tag: "Added without asking" });
    expect(lines[2]).toMatchObject({ label: "Coupon", sign: "minus", amount: 10 });
  });

  it("is empty when no price was seen", () => {
    expect(billLines(bill())).toEqual([]);
  });
});

describe("stopSummary", () => {
  it("says a login comes before the fees when no bill was shown", () => {
    const summary = stopSummary(
      report({
        stop: { at: "login_wall", claimed: "login_wall", note: null, reach: "offer" },
        login: { wallAt: "/login", hidesFees: true, offerSignIn: true },
      }),
    );
    expect(summary).toContain("before it shows its fees");
  });

  it("warns that later steps can add fees when a bill was shown", () => {
    const summary = stopSummary(
      report({ stop: { at: "login_wall", claimed: "login_wall", note: null, reach: "order" } }),
    );
    expect(summary).toContain("can still add fees");
  });
});

describe("signInOffer", () => {
  it("offers to check further when the fees sit behind a login", () => {
    const offer = signInOffer(
      report({ login: { wallAt: "/login", hidesFees: true, offerSignIn: true } }),
    );
    expect(offer).toBe("Sign in to check further");
  });

  it("makes no offer when none is due", () => {
    expect(signInOffer(report())).toBeNull();
  });
});

describe("logoutNote", () => {
  it("is silent for a guest run", () => {
    expect(logoutNote(null)).toBeNull();
  });

  it("confirms the logout", () => {
    expect(logoutNote("logged_out")).toContain("Logged out");
  });

  it("says plainly when the logout could not be confirmed", () => {
    expect(logoutNote("not_confirmed")).toContain("could not confirm");
  });
});

describe("olderAuditNote", () => {
  it("speaks only for an older audit", () => {
    expect(olderAuditNote(report({ older: true }))).toMatch(/before page text was kept/);
    expect(olderAuditNote(report({ older: false }))).toBeNull();
  });
});
