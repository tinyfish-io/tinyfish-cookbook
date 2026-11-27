import { describe, expect, it } from "vite-plus/test";

import { bill, finding, report, subscription } from "../testing/report.ts";
import {
  auditLine,
  billNote,
  billPill,
  foundPatterns,
  priceChange,
  renewalNote,
  rowPills,
  showsBill,
  stats,
  story,
  totalLine,
} from "./story.ts";

const drip = finding({
  id: "drip_pricing",
  label: "Drip pricing",
  severity: "high",
  status: "found",
  step: 4,
  amounts: [
    { label: "Delivery charge", amount: 25 },
    { label: "High demand surge charge", amount: 30 },
    { label: "Handling charge", amount: 2 },
  ],
  screenshot: { stepId: "s4", action: null },
});

const checkout = report({
  priceLabel: "price_before_sign_in",
  bill: bill({
    firstPrice: 24,
    firstPriceStep: 3,
    firstPriceSource: "product_page",
    itemsTotal: 24,
    charges: [
      { name: "Delivery charge", amount: 25, firstSeenAtStep: 4 },
      { name: "Handling charge", amount: 2, firstSeenAtStep: 4 },
      { name: "High demand surge charge", amount: 30, firstSeenAtStep: 4 },
    ],
    total: 81,
    addsUp: true,
    increase: 57,
    multiple: 3.375,
  }),
  patterns: [drip],
});

const trap = finding({
  id: "cancellation_fee",
  label: "Cancellation fee",
  severity: "high",
  status: "found",
  step: 2,
  quote: "Fee applies of half your remaining annual commitment",
  screenshot: { stepId: "s2", action: null },
});

const adobe = report({
  flow: "subscription",
  priceLabel: "last_seen",
  bill: bill({ firstPrice: 1199, total: 1199, increase: 0, multiple: 1, addsUp: true }),
  subscription: subscription({
    billingPeriod: "Annual, billed monthly",
    introPrice: 1199,
    introPeriod: "12 months",
    priceAfterIntro: 2714,
    renewalMultiple: 2.26,
  }),
  patterns: [trap],
});

const urgency = finding({
  id: "scarcity_message",
  label: "Scarcity message",
  status: "found",
  step: 3,
  quote: "Only 2 left",
  note: "Countdown beside the price.",
});

const flat = bill({ firstPrice: 549, total: 549, increase: 0 });

describe("foundPatterns", () => {
  it("lists only what was found, the most serious first", () => {
    const both = report({ patterns: [urgency, drip] });
    expect(foundPatterns(both).map(({ id }) => id)).toEqual(["drip_pricing", "scarcity_message"]);
  });
});

describe("priceChange", () => {
  it("goes from the first price to the total on a bill that grew", () => {
    expect(priceChange(checkout)).toEqual({ from: 24, to: 81, suffix: "", currency: "INR" });
  });

  it("goes from the intro price to the renewal price per billing period", () => {
    expect(priceChange(adobe)).toEqual({ from: 1199, to: 2714, suffix: "/mo", currency: "INR" });
  });

  it("is absent when no price moved", () => {
    expect(priceChange(report({ bill: flat }))).toBeNull();
  });

  it("is absent when the run never reached a total", () => {
    expect(priceChange(report({ bill: bill({ firstPrice: 389 }) }))).toBeNull();
  });
});

describe("showsBill", () => {
  it("shows the bill when drip pricing was found", () => {
    const noted = report({ bill: flat, patterns: [drip] });
    expect(showsBill(noted)).toBe(true);
  });

  it("shows the bill when the price rose, whatever the patterns say", () => {
    expect(showsBill(report({ bill: bill({ firstPrice: 24, total: 81, increase: 57 }) }))).toBe(
      true,
    );
  });

  it("keeps the bill out of a report about something else", () => {
    expect(showsBill(report({ bill: flat, patterns: [urgency] }))).toBe(false);
    expect(showsBill(adobe)).toBe(false);
  });
});

describe("billNote", () => {
  it("says how many charges came after the first price and where it was shown", () => {
    expect(billNote(checkout)).toBe(
      "3 charges show up after the first price. None of them was on the product page, so the price you pay is 3.4 times the price you were shown.",
    );
  });

  it("says first price, not product page, when the cart showed it first", () => {
    const cart = { ...checkout, bill: { ...checkout.bill, firstPriceSource: "cart" as const } };
    expect(billNote(cart)).toContain("None of them was in the first price");
  });

  it("has nothing to say when the price held", () => {
    expect(billNote(report({ bill: flat }))).toBeNull();
  });
});

describe("renewalNote", () => {
  it("states the jump after the offer", () => {
    expect(renewalNote(adobe)).toBe(
      "The site leads with Rs 1,199 for 12 months. Then you pay Rs 2,714, 2.3 times as much.",
    );
  });

  it("has nothing to say without one", () => {
    expect(renewalNote(report({ bill: flat }))).toBeNull();
  });
});

describe("story", () => {
  it("names a lone finding and never a price", () => {
    expect(story(checkout)).toMatchObject({
      tone: "found",
      badge: "Drip pricing, found",
      lead: "Drip pricing",
      accent: "seen",
      tail: ".",
    });
  });

  it("leads with the note of a lone finding", () => {
    expect(story(report({ patterns: [urgency] })).body).toBe("Countdown beside the price.");
  });

  it("falls back to the quote, then to where the run stopped", () => {
    const quoted = { ...urgency, note: "" };
    expect(story(report({ patterns: [quoted] })).body).toBe("Only 2 left");
    const bare = { ...urgency, note: "", quote: null };
    expect(story(report({ patterns: [bare] })).body).toBe(
      "Reached the payment page and stopped there, before paying.",
    );
  });

  it("counts several findings and names each one", () => {
    expect(story(report({ patterns: [urgency, drip, trap] }))).toMatchObject({
      tone: "found",
      badge: "3 patterns found",
      lead: "3 dark patterns",
      accent: "seen",
      tail: ".",
      body: "Drip pricing, cancellation fee and scarcity message.",
    });
  });

  it("puts a subscription's findings ahead of its renewal price", () => {
    expect(story(adobe)).toMatchObject({ lead: "Cancellation fee", accent: "seen" });
  });

  it("says when a login hid the fees", () => {
    const hidden = report({
      stop: { at: "login_wall", claimed: "login_wall", note: null, reach: "offer" },
      login: { wallAt: "cart", hidesFees: true, offerSignIn: true },
      patterns: [finding({ id: "nagging", label: "Nagging", status: "not_checked" })],
    });
    expect(story(hidden)).toMatchObject({
      tone: "open",
      badge: "Fees behind a login",
      lead: "The fees are",
      accent: "behind",
      tail: "a login.",
    });
  });

  it("promises nothing past the page the run reached", () => {
    const partial = report({
      bill: flat,
      patterns: [finding({ id: "nagging", label: "Nagging", status: "not_checked" })],
    });
    expect(story(partial)).toMatchObject({
      tone: "clear",
      badge: "Nothing found so far",
      lead: "Nothing",
      accent: "found",
      tail: "so far.",
    });
  });

  it("counts what was not checked when the run saw no bill", () => {
    const stopped = report({
      patterns: [
        finding({ id: "nagging", label: "Nagging", status: "not_checked" }),
        finding({ id: "drip_pricing", label: "Drip pricing", status: "not_checked" }),
      ],
    });
    expect(story(stopped)).toMatchObject({ tone: "open", lead: "2 patterns", accent: "not" });
  });

  it("calls a run clean only when nothing was left unchecked", () => {
    expect(story(report())).toMatchObject({
      tone: "clear",
      badge: "No patterns found",
      lead: "No dark patterns",
      accent: "found",
    });
  });

  it("never prints how many patterns there are", () => {
    const sayings = [report(), checkout, adobe].map((entry) => JSON.stringify(story(entry)));
    expect(sayings.join(" ")).not.toMatch(/\b13\b/);
  });
});

describe("stats", () => {
  it("shows the findings, what was not checked and the steps", () => {
    expect(stats(checkout, 17)).toEqual([
      { value: "1", label: "Patterns found" },
      { value: "0", label: "Not checked" },
      { value: "17", label: "Steps walked" },
    ]);
  });
});

describe("auditLine", () => {
  const sites = [{ host: "adobe.com" }];

  it("states the flow, the sites and the country that were inferred", () => {
    expect(auditLine({ flow: "subscription", countryName: "India", sites })).toBe(
      "Audited as a subscription sign-up on adobe.com, from India.",
    );
  });

  it("joins several sites", () => {
    const many = [...sites, { host: "spotify.com" }, { host: "netflix.com" }];
    expect(auditLine({ flow: "checkout", countryName: "India", sites: many })).toBe(
      "Audited as a checkout on adobe.com, spotify.com and netflix.com, from India.",
    );
  });

  it("leaves out a country the audit never had", () => {
    expect(auditLine({ flow: "checkout", countryName: null, sites })).toBe(
      "Audited as a checkout on adobe.com.",
    );
  });
});

describe("totalLine", () => {
  it("says what the total is and what the first price was", () => {
    expect(totalLine(checkout)).toEqual({
      lead: "Before sign-in.",
      said: "The product page said",
      shown: "Rs 24",
    });
  });

  it("leaves out the first price when it did not change", () => {
    expect(totalLine(report({ bill: flat }))).toEqual({
      lead: "What you pay.",
      said: null,
      shown: null,
    });
  });
});

describe("billPill", () => {
  it("counts the charges added after the first price", () => {
    expect(billPill(checkout)).toEqual({
      tone: "found",
      text: "3 charges added after the first price",
    });
  });

  it("is clean when the total stayed at the first price", () => {
    expect(billPill(report({ bill: flat }))).toEqual({
      tone: "clean",
      text: "Nothing added so far",
    });
  });

  it("makes no claim without a total", () => {
    expect(billPill(report({ bill: bill({ firstPrice: 389 }) }))).toEqual({
      tone: "unchecked",
      text: "No total reached",
    });
  });
});

describe("rowPills on a run that saw no bill", () => {
  const summary = { state: "done", found: 0, notChecked: 8, total: null } as const;

  it("never calls a blocked site clean", () => {
    const blocked = report({
      bill: bill({ total: null }),
      stop: { ...checkout.stop, at: "blocked" },
    });
    expect(rowPills(summary, blocked)).toEqual([
      { tone: "unchecked", text: "Blocked by the site" },
    ]);
  });

  it("says the run stopped early for any other run that saw no bill", () => {
    const stopped = report({
      bill: bill({ total: null }),
      stop: { ...checkout.stop, at: "incomplete" },
    });
    expect(rowPills(summary, stopped)).toEqual([{ tone: "unchecked", text: "Stopped early" }]);
  });

  it("does not look clean while the report is still loading", () => {
    expect(rowPills(summary, null)).toEqual([{ tone: "unchecked", text: "Stopped early" }]);
  });

  it("stays clean when a bill was seen and nothing was found", () => {
    expect(rowPills({ ...summary, total: 449 }, null)).toEqual([
      { tone: "clean", text: "Nothing found so far" },
    ]);
  });
});

describe("rowPills", () => {
  const summary = { state: "done" as const, found: 1, notChecked: 0, total: 81 };
  const nagging = finding({ id: "nagging", label: "Nagging", status: "found" });

  it("names each finding once the report is known", () => {
    expect(rowPills(summary, checkout)).toEqual([{ tone: "found", text: "Drip pricing" }]);
    expect(rowPills(summary, null)).toEqual([{ tone: "found", text: "1 found" }]);
  });

  it("names two findings and counts the rest", () => {
    const three = report({ patterns: [urgency, drip, nagging] });
    expect(rowPills({ ...summary, found: 3 }, three)).toEqual([
      { tone: "found", text: "Drip pricing" },
      { tone: "found", text: "Scarcity message" },
      { tone: "found", text: "1 more" },
    ]);
  });

  it("shows no count of more for exactly two", () => {
    expect(rowPills({ ...summary, found: 2 }, report({ patterns: [urgency, drip] }))).toHaveLength(
      2,
    );
  });

  it("never reads as clean when a login hid the fees", () => {
    const hidden = report({ login: { wallAt: "cart", hidesFees: true, offerSignIn: true } });
    expect(rowPills({ ...summary, found: 0, notChecked: 8 }, hidden)).toEqual([
      { tone: "unchecked", text: "Fees behind a login" },
    ]);
  });

  it("keeps so far on a clean row with pages left unchecked", () => {
    expect(rowPills({ ...summary, found: 0, notChecked: 5 }, report())).toEqual([
      { tone: "clean", text: "Nothing found so far" },
    ]);
  });

  it("shows the state of a site still in progress", () => {
    expect(rowPills({ state: "running", found: 0, notChecked: 0, total: null }, null)).toEqual([
      { tone: "live", text: "Running" },
    ]);
  });

  it("says no patterns were found only when every one was checked", () => {
    expect(rowPills({ ...summary, found: 0 }, report())).toEqual([
      { tone: "clean", text: "No patterns found" },
    ]);
  });
});
