import { describe, expect, it } from "vite-plus/test";

import { ago, clock, dateTime, duration, money, moneyParts, perPeriod, plural } from "./format.ts";

describe("moneyParts", () => {
  it("splits off the paise so they can be drawn lighter", () => {
    expect(moneyParts(81, "INR")).toEqual({ main: "Rs 81", minor: ".00" });
    expect(moneyParts(497.18, "INR")).toEqual({ main: "Rs 497", minor: ".18" });
    expect(moneyParts(125000, "INR")).toEqual({ main: "Rs 1,25,000", minor: ".00" });
  });
});

describe("duration", () => {
  it("writes minutes and seconds", () => {
    expect(duration("2026-10-31T14:32:00Z", "2026-10-31T14:34:45Z")).toBe("2m 45s");
  });

  it("drops the minutes under one minute", () => {
    expect(duration("2026-10-31T14:32:00Z", "2026-10-31T14:32:09Z")).toBe("9s");
  });
});

describe("ago", () => {
  const now = Date.parse("2026-10-31T14:32:30Z");

  it("calls the last few seconds now", () => {
    expect(ago("2026-10-31T14:32:29Z", now)).toBe("now");
  });

  it("counts seconds, then minutes", () => {
    expect(ago("2026-10-31T14:32:09Z", now)).toBe("21s");
    expect(ago("2026-10-31T14:29:30Z", now)).toBe("3m");
  });

  it("moves to hours for a run opened long after it stopped", () => {
    expect(ago("2026-10-31T12:30:30Z", now)).toBe("2h");
  });
});

describe("money", () => {
  it("writes rupees as Rs with Indian grouping", () => {
    expect(money(81, "INR")).toBe("Rs 81");
    expect(money(125000, "INR")).toBe("Rs 1,25,000");
  });

  it("keeps two decimals only when the amount has paise", () => {
    expect(money(441.66, "INR")).toBe("Rs 441.66");
    expect(money(12.5, "INR")).toBe("Rs 12.50");
  });

  it("names any other currency by its code", () => {
    expect(money(12.5, "USD")).toBe("USD 12.50");
  });

  it("shows the bare number when no currency was seen", () => {
    expect(money(79, null)).toBe("79");
  });
});

describe("perPeriod", () => {
  it("writes one slash whatever form the agent gave", () => {
    expect(perPeriod("/mo")).toBe("/mo");
    expect(perPeriod("month")).toBe("/mo");
    expect(perPeriod("per year")).toBe("/yr");
    expect(perPeriod("/yr")).toBe("/yr");
    expect(perPeriod("2 months")).toBe("/2 months");
  });

  it("reads the way plans name their billing", () => {
    expect(perPeriod("Monthly")).toBe("/mo");
    expect(perPeriod("Annual, billed monthly")).toBe("/mo");
    expect(perPeriod("Annual, prepaid")).toBe("/yr");
    expect(perPeriod("Yearly")).toBe("/yr");
  });

  it("writes nothing when there is no period", () => {
    expect(perPeriod(null)).toBe("");
  });
});

describe("dates", () => {
  it("uses the 12-hour clock with plain spaces", () => {
    expect(clock("2026-11-01T08:44:00.000Z")).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });

  it("writes the date before the time", () => {
    expect(dateTime("2026-11-01T08:44:00.000Z")).toMatch(
      /^\d{1,2} [A-Z][a-z]{2} 2026, \d{1,2}:\d{2} (AM|PM)$/,
    );
  });
});

describe("plural", () => {
  it("counts one and many", () => {
    expect(plural(1, "pattern")).toBe("1 pattern");
    expect(plural(3, "pattern")).toBe("3 patterns");
    expect(plural(0, "site")).toBe("0 sites");
  });
});
