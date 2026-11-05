import { describe, expect, it } from "vite-plus/test";

import { scrubPersonal } from "./scrub.ts";

describe("scrubPersonal", () => {
  it("removes phone numbers and email addresses from every string", () => {
    const scrubbed = scrubPersonal({
      note: "Deliver to +91 98765 43210 or 9876543210, mail me@example.com",
      nested: [{ text: "Call 919876543210" }],
    });

    expect(JSON.stringify(scrubbed)).not.toMatch(/98765|me@example/);
  });

  it("removes a one-time code the agent wrote down", () => {
    expect(scrubPersonal("OTP is 482913 for login")).not.toContain("482913");
    expect(scrubPersonal("one-time password: 4829")).not.toContain("4829");
  });

  it("leaves prices, pincodes, ids and non-strings alone", () => {
    const value = {
      note: "Total Rs 1,199.00 at pincode 560034, order 12345678",
      url: "https://shop.test/p/itm74bab5c12adc7?pageUID=1793287044951",
      amount: 9876543210,
      ok: true,
      none: null,
    };

    expect(scrubPersonal(value)).toEqual(value);
  });
});
