import { describe, expect, it } from "vite-plus/test";

import { capturedEverywhere, loadRun } from "../testing/fixtures.ts";
import type { RunRecord } from "../tinyfish/types.ts";
import { judgeRun, judgeSavedReport, RULES_VERSION } from "./judge.ts";
import type { PageCapture } from "./pageText.ts";
import { capturePage, htmlToText } from "./pageText.ts";
import { isNoCommitment } from "./patterns.ts";
import type { Flow, PatternId, SiteReport } from "./types.ts";
import { PATTERN_IDS } from "./types.ts";

function judge(name: string, flow: Flow = "checkout", edit?: (run: RunRecord) => void): SiteReport {
  const run = loadRun(name);
  edit?.(run);
  return judgeRun({ flow, url: "https://example.test/", run, captures: capturedEverywhere(run) });
}

function pattern(report: SiteReport, id: PatternId) {
  const finding = report.patterns.find((entry) => entry.id === id);
  if (!finding) throw new Error(`no finding for ${id}`);
  return finding;
}

const ORDER_PAGE_PATTERNS: PatternId[] = [
  "basket_sneaking",
  "confirmshaming",
  "bait_and_switch",
  "drip_pricing",
  "preselected_extra",
  "free_claim",
];

describe("every report", () => {
  it.each([
    "blinkit",
    "blinkit-2",
    "croma",
    "flipkart",
    "myntra",
    "zomato",
    "zomato-signed-in",
    "zomato-signed-in-2",
    "amazon",
    "ajio",
  ])("lists every pattern exactly once for %s", (name) => {
    const ids = judge(name).patterns.map((entry) => entry.id);

    expect(ids.toSorted()).toEqual([...PATTERN_IDS].toSorted());
  });
});

describe("patterns a flow cannot have", () => {
  const SUBSCRIPTION_ONLY: PatternId[] = [
    "preselected_plan",
    "trial_needs_card",
    "renewal_small_print",
    "intro_price_jump",
    "cancellation_fee",
    "hard_to_cancel",
    "cancellation_terms_missing",
  ];

  it("says the subscription patterns do not apply to a one-off purchase", () => {
    const report = judge("croma");

    for (const id of SUBSCRIPTION_ONLY) {
      expect(pattern(report, id).status).toBe("not_applicable");
      expect(pattern(report, id).note).toMatch(/one-off purchase/);
    }
    expect(pattern(report, "hidden_subscription").status).not.toBe("not_applicable");
  });

  it("says a price behind sign-in does not apply to a sign-up, which needs the account", () => {
    const report = judge("adobe-subscription", "subscription");

    expect(pattern(report, "price_behind_signin").status).toBe("not_applicable");
    expect(pattern(report, "price_behind_signin").note).toMatch(/subscription sign-up/);
    for (const id of SUBSCRIPTION_ONLY) {
      expect(pattern(report, id).status).not.toBe("not_applicable");
    }
  });

  it("says so even for a run that brought back nothing", () => {
    const report = judge("blinkit-page-never-loaded", "checkout", (run) => {
      run.result = null;
    });

    expect(pattern(report, "hard_to_cancel").status).toBe("not_applicable");
    expect(pattern(report, "drip_pricing").status).toBe("not_checked");
  });
});

describe("drip pricing on checkouts", () => {
  it("proves the Blinkit jump by arithmetic and does not count Items total as a fee", () => {
    const report = judge("blinkit-2");
    const drip = pattern(report, "drip_pricing");

    expect(report.bill.firstPrice).toBe(24);
    expect(report.bill.total).toBe(81);
    expect(report.bill.charges.map((fee) => fee.name)).toEqual([
      "Delivery charge",
      "Handling charge",
      "High demand surge charge",
    ]);
    expect(report.bill.addsUp).toBe(true);
    expect(report.bill.multiple).toBeCloseTo(3.38, 2);
    expect(drip.status).toBe("found");
    expect(drip.step).toBe(4);
    expect(drip.amounts).toContainEqual({ label: "High demand surge charge", amount: 30 });
  });

  it("takes the listed price from the product page, not the agent's MRP", () => {
    const report = judge("flipkart");

    expect(report.bill.firstPrice).toBe(192);
    expect(report.bill.firstPriceSource).toBe("product_page");
    expect(report.bill.total).toBe(201);
    expect(report.bill.addsUp).toBe(true);
    expect(pattern(report, "drip_pricing").status).toBe("found");
  });

  it("recovers a total the agent left null when the page total adds up", () => {
    const report = judge("myntra");

    expect(report.bill.total).toBe(622);
    expect(report.bill.addsUp).toBe(true);
    expect(pattern(report, "drip_pricing").status).toBe("found");
  });

  it("checks the Zomato bill against the item total line", () => {
    const report = judge("zomato-signed-in-2");

    expect(report.bill.total).toBe(497.18);
    expect(report.bill.addsUp).toBe(true);
    expect(report.bill.charges.map((fee) => fee.name)).toEqual([
      "Restaurant Packaging Charge",
      "Delivery Partner Fee",
      "Platform Fee",
      "GST (govt. taxes)",
    ]);
    expect(pattern(report, "drip_pricing").status).toBe("found");
  });

  it("shows no finding for a rise it cannot reconcile", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (run.result) run.result["final_price"] = 95;
    });

    expect(report.bill.addsUp).toBe(false);
    expect(report.bill.unexplained).toBe(14);
    expect(pattern(report, "drip_pricing").status).toBe("not_checked");
  });

  it("does not call a tax added at checkout drip pricing", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (!run.result) return;
      run.result["fees"] = [
        { name: "Sales tax", amount: 2, first_seen_at_step: 4, included_in_first_price: false },
      ];
      run.result["final_price"] = 26;
    });

    expect(report.bill.addsUp).toBe(true);
    expect(pattern(report, "drip_pricing").status).toBe("not_found");
  });

  it("keeps a total below the item price out of the bill, since it is a count", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (run.result) {
        run.result["final_price"] = 1;
        run.result["fees"] = [];
        run.result["steps"] = [];
      }
    });

    expect(report.bill.total).toBeNull();
  });
});

describe("the live Blinkit run of 1 Nov, checked against its screenshots", () => {
  const report = judge("blinkit-3");

  it("has the bill the cart showed", () => {
    expect(report.item).toBe("Country Delight Buffalo Fresh Milk");
    expect(report.bill.currency).toBe("INR");
    expect(report.bill.firstPrice).toBe(52);
    expect(report.bill.total).toBe(79);
    expect(report.bill.increase).toBe(27);
    expect(report.bill.addsUp).toBe(true);
    expect(report.bill.charges.map(({ name, amount }) => [name, amount])).toEqual([
      ["Delivery charge", 25],
      ["Handling charge", 2],
    ]);
  });

  it("finds drip pricing and stops honestly at the login wall", () => {
    const drip = pattern(report, "drip_pricing");

    expect(drip.status).toBe("found");
    expect(drip.step).toBe(3);
    expect(drip.screenshot?.action).toBe("Get full cart and bill details");
    expect(report.stop.at).toBe("login_wall");
    expect(report.priceLabel).toBe("price_before_sign_in");
    expect(report.login.offerSignIn).toBe(true);
  });

  it("says the payment page was out of reach, and does not blame the bill", () => {
    const hidden = pattern(report, "hidden_subscription");

    expect(hidden.status).toBe("not_checked");
    expect(hidden.note).toMatch(/payment page/i);
    expect(hidden.note).not.toMatch(/bill/i);
  });

  it("flags that the agent changed its browser to get past a block", () => {
    expect(report.flags.map((flag) => flag.kind)).toEqual(["browser_changed"]);
  });

  it("gives every page its own working screenshot", () => {
    const shots = report.pages.map((page) => page.screenshot?.stepId);

    expect(new Set(shots).size).toBe(4);
  });
});

describe("currency", () => {
  it.each([
    ["\u20B9", "INR"],
    ["INR", "INR"],
    ["INR (\u20B9)", "INR"],
    ["Rs", "INR"],
    ["$", "USD"],
    ["USD", "USD"],
  ])("reads %s as %s", (written, code) => {
    const report = judge("blinkit-3", "checkout", (run) => {
      if (run.result) run.result["currency"] = written;
    });

    expect(report.bill.currency).toBe(code);
  });

  it("does not guess at a currency it cannot read", () => {
    const report = judge("blinkit-3", "checkout", (run) => {
      if (run.result) run.result["currency"] = "credits";
    });

    expect(report.bill.currency).toBeNull();
  });
});

describe("login walls", () => {
  it("never gives a clean report when the site hides its fees", () => {
    const report = judge("zomato");

    expect(report.stop.at).toBe("login_wall");
    expect(report.bill.total).toBeNull();
    expect(report.login.hidesFees).toBe(true);
    expect(report.login.offerSignIn).toBe(true);
    expect(report.priceLabel).toBe("none");
    expect(pattern(report, "drip_pricing").status).toBe("not_checked");
    expect(pattern(report, "drip_pricing").note).toMatch(/sign-in/i);
  });

  it("offers no sign-in once a sign-up's terms were all seen before the wall", () => {
    const edit = (terms: Record<string, string>[]) => (run: RunRecord) => {
      if (!run.result) return;
      run.result["stopped_at"] = "login_wall";
      run.result["terms"] = terms;
    };
    const renewal = {
      term: "renewal",
      quote: "Renews every month",
      shown_where: "main_page",
    };
    const cancellation = {
      term: "cancellation",
      quote: "Cancel anytime",
      shown_where: "main_page",
    };

    const settled = judge("spotify-subscription", "subscription", edit([renewal, cancellation]));
    const open = judge("spotify-subscription", "subscription", edit([renewal]));

    expect(settled.login.offerSignIn).toBe(false);
    expect(open.login.offerSignIn).toBe(true);
  });

  it("labels an itemised bill behind a login wall as price before sign-in", () => {
    const report = judge("blinkit-2");

    expect(report.priceLabel).toBe("price_before_sign_in");
    expect(report.login.hidesFees).toBe(false);
    expect(report.login.offerSignIn).toBe(true);
  });

  it("uses a cart's stated total when the agent left the final price empty", () => {
    const report = judge("croma", "checkout", (run) => {
      if (!run.result) return;
      run.result["final_price"] = null;
      const pages = run.result["steps"] as { price_shown: number | null; note: string }[];
      for (const page of pages) {
        if (page.note.includes("Total")) page.note = "Order Summary: Price ₹549, Total ₹549.";
      }
    });

    expect(report.bill.total).toBe(549);
    expect(report.bill.increase).toBe(0);
    expect(report.login.hidesFees).toBe(false);
  });

  it("keeps a delivery choice that is not in the total off the bill and says so", () => {
    const report = judge("croma", "checkout", (run) => {
      if (!run.result) return;
      run.result["fees"] = [
        { name: "Delivery", amount: 29, first_seen_at_step: 4, included_in_first_price: false },
      ];
    });

    expect(report.bill.total).toBe(549);
    expect(report.bill.charges).toEqual([]);
    expect(report.bill.notInTotal).toEqual([{ name: "Delivery", amount: 29, firstSeenAtStep: 4 }]);
    expect(report.bill.addsUp).toBe(true);
    expect(report.bill.unexplained).toBeNull();
    expect(report.missing.join(" ")).toMatch(/Delivery.*29.*not in this total/);
  });

  it("believes the total the cart states over a sum the agent worked out itself", () => {
    const report = judge("croma", "checkout", (run) => {
      if (!run.result) return;
      run.result["final_price"] = 578;
      run.result["fees"] = [
        {
          name: "Standard Delivery",
          amount: 29,
          first_seen_at_step: 4,
          included_in_first_price: false,
        },
      ];
      const pages = run.result["steps"] as { note: string }[];
      for (const page of pages) {
        if (page.note.includes("Total")) {
          page.note =
            "Order summary: Original Price ₹549.00, Total ₹549.00. Delivery fee ₹29 mentioned.";
        }
      }
    });

    expect(report.bill.total).toBe(549);
    expect(report.bill.increase).toBe(0);
    expect(report.bill.notInTotal.map((line) => line.name)).toEqual(["Standard Delivery"]);
    expect(pattern(report, "drip_pricing").status).toBe("not_found");
  });

  it("reads a stated total in dollars or pounds as well as rupees", () => {
    for (const total of ["$549.00", "£549.00"]) {
      const report = judge("croma", "checkout", (run) => {
        if (!run.result) return;
        run.result["final_price"] = null;
        const pages = run.result["steps"] as { note: string }[];
        for (const page of pages) {
          if (page.note.includes("Total")) page.note = `Order Summary: Total ${total}.`;
        }
      });
      expect(report.bill.total).toBe(549);
    }
  });

  it("reads the grand total, not the item total, from a cart's note", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (!run.result) return;
      const pages = run.result["steps"] as { note: string | null }[];
      for (const page of pages) {
        if (page.note?.includes("Grand total")) {
          page.note = "Items total ₹24, Delivery charge ₹25, Grand total ₹81.";
        }
      }
    });

    expect(report.bill.total).toBe(81);
    expect(report.bill.addsUp).toBe(true);
  });

  it("still reports a shortfall that no single line explains", () => {
    const report = judge("croma", "checkout", (run) => {
      if (!run.result) return;
      run.result["fees"] = [
        { name: "Delivery", amount: 29, first_seen_at_step: 4, included_in_first_price: false },
        { name: "Handling", amount: 5, first_seen_at_step: 4, included_in_first_price: false },
      ];
      run.result["final_price"] = 570;
    });

    expect(report.bill.notInTotal).toEqual([]);
    expect(report.bill.addsUp).toBe(false);
    expect(report.bill.unexplained).toBeNull();
    expect(report.bill.linesOverTotal).toBe(13);
  });

  it("never calls lines above the total an amount on no line", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (!run.result) return;
      run.result["final_price"] = 70;
    });

    expect(report.bill.addsUp).toBe(false);
    expect(report.bill.unexplained).toBeNull();
    expect(report.bill.linesOverTotal).toBe(11);
    expect(pattern(report, "drip_pricing").status).toBe("not_checked");
  });

  it("drops a slash the agent left on a billing period", () => {
    const report = judge("adobe-subscription", "subscription", (run) => {
      if (!run.result) return;
      run.result["plan_options"] = [
        { label: "Monthly", price: 4071, period: "/mo", first_seen_at_step: 4 },
        { label: "Prepaid", price: 12999, period: " per year", first_seen_at_step: 4 },
      ];
    });

    expect(report.subscription?.options.map((option) => option.period)).toEqual(["mo", "year"]);
  });

  it("does not treat a cart's item price as a total when no total was stated", () => {
    const report = judge("croma", "checkout", (run) => {
      if (!run.result) return;
      run.result["final_price"] = null;
      const pages = run.result["steps"] as { note: string }[];
      for (const page of pages) page.note = "Cart shows the item.";
    });

    expect(report.bill.total).toBeNull();
  });

  it("labels Croma's honest total as price before sign-in and finds no drip so far", () => {
    const report = judge("croma");
    const drip = pattern(report, "drip_pricing");

    expect(report.priceLabel).toBe("price_before_sign_in");
    expect(report.bill.total).toBe(549);
    expect(drip.status).toBe("not_found");
    expect(drip.soFar).toBe(true);
  });
});

describe("the agent's claims", () => {
  it("demotes a payment_page claim made after running out of budget", () => {
    const report = judge("amazon");

    expect(report.stop.claimed).toBe("payment_page");
    expect(report.stop.at).toBe("incomplete");
    expect(report.bill.total).toBeNull();
    expect(report.missing.join(" ")).toMatch(/payment page/i);
    for (const id of ORDER_PAGE_PATTERNS) {
      expect(pattern(report, id).status).toBe("not_checked");
    }
  });

  const stoppingWith = (fields: Record<string, unknown>) => (run: RunRecord) => {
    if (run.result) Object.assign(run.result, fields);
  };

  it("reads a run that spent its time on bot checks before any price as blocked", () => {
    const report = judge(
      "blinkit-page-never-loaded",
      "checkout",
      stoppingWith({
        stop_note:
          "Reached step/time budget. Encountered repeated security/bot detection pages that blocked navigation to the event pages.",
      }),
    );

    expect(report.stop.claimed).toBe("incomplete");
    expect(report.stop.at).toBe("blocked");
  });

  it("keeps a run that saw a price before a check stopped it as incomplete", () => {
    const report = judge(
      "blinkit-page-never-loaded",
      "checkout",
      stoppingWith({
        item_listed_price: 329,
        stop_note: "Budget exhausted. A bot check blocked the basket page.",
      }),
    );

    expect(report.stop.at).toBe("incomplete");
  });

  it("does not read a check the run got through as a block", () => {
    const report = judge(
      "blinkit-page-never-loaded",
      "checkout",
      stoppingWith({
        stop_note:
          "Budget exhausted. The site showed a Cloudflare verification on first visit, which passed automatically.",
      }),
    );

    expect(report.stop.at).toBe("incomplete");
  });

  it("does not believe a final price with no steps, fees or pages behind it", () => {
    const report = judge("zomato-signed-in");

    expect(report.stop.at).toBe("incomplete");
    expect(report.bill.total).toBeNull();
    expect(report.missing.join(" ")).toMatch(/497\.18/);
    expect(
      report.patterns.every(
        ({ status }) => status === "not_checked" || status === "not_applicable",
      ),
    ).toBe(true);
  });

  it("drops an item from basket sneaking when the agent added it itself", () => {
    const report = judge("zomato-signed-in-2", "checkout", (run) => {
      if (run.result) {
        run.result["added_without_asking"] = [{ name: "Coke Tin", cost: 66.66, seen_at_step: 2 }];
      }
      run.steps.push({
        id: "own-add",
        timestamp: "2026-10-29T17:00:00Z",
        status: "RUNNING",
        action: "Add one Coke Tin to the cart",
        screenshot: null,
        duration: null,
      });
    });

    expect(pattern(report, "basket_sneaking").status).toBe("not_found");
  });

  it("does not count a pre-ticked donation that is not in the total", () => {
    const basket = pattern(judge("zomato-signed-in-2"), "basket_sneaking");

    expect(basket.status).toBe("not_found");
    expect(basket.soFar).toBe(true);
  });

  it("counts a pre-ticked extra whose amount is in the total", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (run.result) {
        run.result["pre_ticked_options"] = [
          { label: "Delivery insurance", cost: 15, included_in_total: true, seen_at_step: 4 },
        ];
        run.result["final_price"] = 96;
      }
    });
    const basket = pattern(report, "basket_sneaking");

    expect(basket.status).toBe("found");
    expect(basket.amounts).toContainEqual({ label: "Delivery insurance", amount: 15 });
  });

  it("ignores a pre-ticked option the agent marks included when the bill says otherwise", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (run.result) {
        run.result["pre_ticked_options"] = [
          { label: "Delivery insurance", cost: 15, included_in_total: true, seen_at_step: 4 },
        ];
      }
    });

    expect(pattern(report, "basket_sneaking").status).toBe("not_found");
  });
});

describe("urgency and social messages", () => {
  function withMessage(text: string) {
    return judge("blinkit-2", "checkout", (run) => {
      if (run.result) run.result["pressure_messages"] = [{ text, seen_at_step: 3 }];
    });
  }

  it.each([
    ["Only 2 left in stock", "scarcity_message"],
    ["3 seats left at this price", "scarcity_message"],
    ["Offer ends in 09:59", "countdown"],
    ["Sale ends tonight", "countdown"],
    ["Selling fast", "high_demand"],
    ["In high demand", "high_demand"],
    ["27 people viewing this right now", "activity_message"],
    ["Booked 14 times today", "activity_message"],
  ] as const)("reads %s as %s", (text, id) => {
    const finding = pattern(withMessage(text), id);

    expect(finding.status).toBe("found");
    expect(finding.quote).toBe(text);
    expect(finding.step).toBe(3);
  });

  it("says what was shown and never that it is false", () => {
    const { label, note } = pattern(withMessage("Only 2 left in stock"), "scarcity_message");

    expect(label).toBe("Scarcity message");
    expect(`${label} ${note}`).not.toMatch(/fake|false|illegal|violat/i);
  });

  it("does not treat discounts as urgency", () => {
    const report = judge("adobe-subscription", "subscription");

    expect(pattern(report, "countdown").status).toBe("not_found");
    expect(pattern(report, "scarcity_message").status).toBe("not_found");
  });
});

describe("text patterns", () => {
  it("finds guilt nudges as confirmshaming", () => {
    const finding = pattern(judge("zomato-signed-in-2"), "confirmshaming");

    expect(finding.status).toBe("found");
    expect(finding.quote).toMatch(/brighten their day|malnutrition/);
  });

  it("finds shaming decline wording", () => {
    const finding = pattern(
      judge("blinkit-2", "checkout", (run) => {
        if (run.result) run.result["decline_wording"] = ["No, I'll risk it"];
      }),
      "confirmshaming",
    );

    expect(finding.status).toBe("found");
    expect(finding.quote).toBe("No, I'll risk it");
  });

  it("leaves a plain decline alone", () => {
    const finding = pattern(
      judge("blinkit-2", "checkout", (run) => {
        if (run.result) run.result["decline_wording"] = ["No thanks", "Skip", "Not now"];
      }),
      "confirmshaming",
    );

    expect(finding.status).toBe("not_found");
  });

  it("says not checked when the run never reported on a pattern", () => {
    expect(pattern(judge("blinkit-2"), "nagging").status).toBe("not_checked");
  });
});

describe("signals only the new agent reports", () => {
  function fresh(extra: Record<string, unknown>) {
    return judge("blinkit-2", "checkout", (run) => {
      if (!run.result) return;
      Object.assign(
        run.result,
        {
          cart_item_count: 1,
          price_anchors: [],
          cookie_banners: [],
          emphasis_pairs: [],
          repeated_prompts: [],
          pattern_checks: [],
        },
        extra,
      );
    });
  }

  it("treats a pattern it could look for and did not see as not found", () => {
    expect(pattern(fresh({}), "nagging").status).toBe("not_found");
    expect(pattern(fresh({}), "no_cookie_reject").status).toBe("not_found");
  });

  it("names a crossed-out price and never calls it false", () => {
    const finding = pattern(
      fresh({
        price_anchors: [
          { quote: "Rs 999 Rs 499 (50% off)", price: 499, reference_price: 999, seen_at_step: 2 },
        ],
      }),
      "reference_price",
    );

    expect(finding.status).toBe("found");
    expect(finding.quote).toBe("Rs 999 Rs 499 (50% off)");
    expect(finding.severity).toBe("low");
  });

  it("finds a cookie banner with no reject button", () => {
    const banner = (reject: string | null) => ({
      cookie_banners: [
        { accept_label: "Accept all cookies", reject_label: reject, seen_at_step: 1 },
      ],
    });

    expect(pattern(fresh(banner(null)), "no_cookie_reject").status).toBe("found");
    expect(pattern(fresh(banner("Reject all")), "no_cookie_reject").status).toBe("not_found");
  });

  it("does not count a cookie notice that only closes", () => {
    const notice = {
      cookie_banners: [{ accept_label: "Delivery charge", reject_label: null, seen_at_step: 1 }],
    };

    expect(pattern(fresh(notice), "no_cookie_reject").status).toBe("not_found");
  });

  it("needs a prompt to come back on a second step before calling it nagging", () => {
    const nag = (steps: number[]) => ({
      repeated_prompts: [{ text: "Get the app for a better deal", seen_at_steps: steps }],
    });

    expect(pattern(fresh(nag([2, 4])), "nagging").status).toBe("found");
    expect(pattern(fresh(nag([2])), "nagging").status).toBe("not_found");
    expect(pattern(fresh(nag([2, 2])), "nagging").status).toBe("not_found");
  });

  it("wants both sides of a false hierarchy on the page", () => {
    const pair = (muted: string) => ({
      emphasis_pairs: [{ prominent: "Delivery charge", muted, seen_at_step: 3 }],
    });
    const run = loadRun("blinkit-2");
    const captures = capturedEverywhere(run);
    if (run.result) {
      Object.assign(run.result, {
        price_anchors: [],
        ...pair("no thanks, keep the basic plan"),
      });
    }
    const invented = judgeRun({ flow: "checkout", url: "https://example.test/", run, captures });

    expect(pattern(fresh(pair("Handling charge")), "false_hierarchy").status).toBe("found");
    expect(pattern(invented, "false_hierarchy").status).toBe("not_checked");
  });

  it("finds a free claim only when the bill charges for the same thing", () => {
    const claim = (quote: string) => ({
      pattern_checks: [
        { pattern: "free_claim", status: "found", quote, seen_at_step: 2, note: null },
      ],
    });

    expect(pattern(fresh(claim("Free delivery today")), "free_claim").status).toBe("found");
    expect(pattern(fresh(claim("Free returns")), "free_claim").status).toBe("not_found");
    expect(pattern(fresh(claim("Free delivery above Rs 499")), "free_claim").status).toBe(
      "not_found",
    );
  });

  it("wants a fee named in a split price, and never counts tax", () => {
    const split = (quote: string) => ({
      pattern_checks: [
        { pattern: "partitioned_pricing", status: "found", quote, seen_at_step: 2, note: null },
      ],
    });

    expect(pattern(fresh(split("$120 + $25 resort fee")), "partitioned_pricing").status).toBe(
      "found",
    );
    expect(pattern(fresh(split("$120 + taxes")), "partitioned_pricing").status).toBe("not_found");
  });

  it("drops an account from forced action", () => {
    const force = (quote: string) => ({
      pattern_checks: [{ pattern: "forced_action", status: "found", quote, seen_at_step: 2 }],
    });

    expect(pattern(fresh(force("Create an account to go on")), "forced_action").status).toBe(
      "not_found",
    );
    expect(pattern(fresh(force("Add the insurance to continue")), "forced_action").status).toBe(
      "found",
    );
    expect(
      pattern(
        fresh(force("By proceeding, you agree to our T&C and Privacy policy")),
        "forced_action",
      ).status,
    ).toBe("not_found");
  });

  it("wants a negative or an opt-out in a trick question", () => {
    const trick = (quote: string) => ({
      pattern_checks: [{ pattern: "trick_question", status: "found", quote, seen_at_step: 2 }],
    });

    expect(
      pattern(fresh(trick("Untick if you do not want to not receive offers")), "trick_question")
        .status,
    ).toBe("found");
    expect(pattern(fresh(trick("Choose a plan")), "trick_question").status).toBe("not_found");
  });

  it("asks for one item in the cart before calling a higher price bait and switch", () => {
    const edit = (count: number | null) => (run: RunRecord) => {
      if (!run.result) return;
      run.result["cart_item_count"] = count;
      run.result["item_listed_price"] = 20;
      const [, , product] = run.result["steps"] as { total_shown: number | null }[];
      if (product) product.total_shown = 20;
      run.result["fees"] = [
        { name: "Items total", amount: 24, first_seen_at_step: 3, included_in_first_price: false },
        { name: "Delivery charge", amount: 25, first_seen_at_step: 3 },
        { name: "Handling charge", amount: 2, first_seen_at_step: 3 },
        { name: "High demand surge charge", amount: 30, first_seen_at_step: 3 },
      ];
    };

    expect(pattern(judge("blinkit-2", "checkout", edit(1)), "bait_and_switch").status).toBe(
      "found",
    );
    expect(pattern(judge("blinkit-2", "checkout", edit(2)), "bait_and_switch").status).toBe(
      "not_found",
    );
    expect(pattern(judge("blinkit-2", "checkout", edit(null)), "bait_and_switch").status).toBe(
      "not_checked",
    );
  });

  it("reads the old pattern names from runs saved before the change", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (!run.result) return;
      run.result["price_anchors"] = [];
      run.result["pattern_checks"] = [
        { pattern: "disguised_advertisement", status: "found", quote: "Delivery charge" },
      ];
    });

    expect(pattern(report, "disguised_ad").status).toBe("found");
  });
});

describe("a checkout that hides its price behind sign-in", () => {
  const wall = (run: RunRecord) => {
    if (!run.result) return;
    Object.assign(run.result, {
      price_anchors: [],
      pattern_checks: [
        { pattern: "price_behind_signin", status: "found", quote: "Log in to continue" },
      ],
    });
  };

  it("is found when no total was shown", () => {
    const report = judge("zomato", "checkout", wall);

    expect(report.bill.total).toBeNull();
    expect(pattern(report, "price_behind_signin").status).toBe("found");
  });

  it("takes the words of the wall from the field the agent always fills", () => {
    const report = judge("zomato", "checkout", (run) => {
      if (!run.result) return;
      Object.assign(run.result, {
        price_anchors: [],
        pattern_checks: [],
        login_prompt: "Log in to continue",
      });
    });

    expect(pattern(report, "price_behind_signin").quote).toBe("Log in to continue");
  });

  it("never counts the account a subscription needs", () => {
    const report = judge("zomato", "subscription", wall);

    expect(pattern(report, "price_behind_signin").status).toBe("not_applicable");
  });
});

describe("what the saved pages say for themselves", () => {
  const SHOP_PAGE = `<p>We have 2 left at this price</p><p>Limited-time Deal</p>
    <p>18 people are looking at this right now</p><p><del>$120</del> <b>$99</b></p>
    <p>$99 + $25 resort fee</p><button>No thanks, I prefer paying full price</button>
    <label><input type="checkbox" checked> Send me special offers</label>
    <p>We use cookies</p><button>Accept all</button>`;

  function fromPages(html: string) {
    const run = loadRun("blinkit-2");
    const stepId = run.steps[3]?.id ?? "";
    const captures = [capturePage(stepId, html)];
    return judgeRun({ flow: "checkout", url: "https://example.test/", run, captures });
  }

  it.each([
    ["scarcity_message", "We have 2 left at this price"],
    ["countdown", "Limited-time Deal"],
    ["activity_message", "18 people are looking at this right now"],
    ["reference_price", "$120 $99"],
    ["partitioned_pricing", "$99 + $25 resort fee"],
    ["confirmshaming", "No thanks, I prefer paying full price"],
    ["preticked_consent", "Send me special offers"],
    ["no_cookie_reject", "Accept all"],
  ] satisfies [PatternId, string][])("finds %s though the agent listed none", (id, quote) => {
    const finding = pattern(fromPages(SHOP_PAGE), id);

    expect(finding.status).toBe("found");
    expect(finding.quote).toBe(quote);
    expect(finding.screenshot).not.toBeNull();
  });

  it("calls them not found once the pages were read and hold none", () => {
    const report = fromPages("<p>A plain page</p>");

    expect(pattern(report, "countdown").status).toBe("not_found");
    expect(pattern(report, "reference_price").status).toBe("not_found");
    expect(pattern(report, "no_cookie_reject").status).toBe("not_found");
  });

  it("believes an agent that saw a reject button over a page that hid it", () => {
    const run = loadRun("blinkit-2");
    if (run.result) {
      run.result["cookie_banners"] = [
        { accept_label: "Accept all", reject_label: "Reject all", seen_at_step: 1 },
      ];
    }
    const captures = [capturePage(run.steps[3]?.id ?? "", SHOP_PAGE)];
    const report = judgeRun({ flow: "checkout", url: "https://example.test/", run, captures });

    expect(pattern(report, "no_cookie_reject").status).toBe("not_found");
  });
});

describe("terms the saved pages show, whatever the agent said", () => {
  const LEGAL = `<div data-testid="legal-offer-section"><p>You will be automatically charged $4.00 every 4 weeks for 1 year, then $30.00 every 4 weeks.</p></div>`;

  function subscription(html: string, terms: Record<string, unknown>) {
    const run = loadRun("spotify-subscription");
    if (run.result)
      Object.assign(run.result, { terms, intro_price: null, price_after_intro: null });
    const captures = [capturePage(run.steps[3]?.id ?? "", html)];
    return judgeRun({ flow: "subscription", url: "https://example.test/", run, captures });
  }
  const notShown = { quote: null, shown_where: "not_shown", seen_at_step: null };

  it("finds renewal in the small print when the agent said it was not shown", () => {
    const finding = pattern(subscription(LEGAL, { renewal: notShown }), "renewal_small_print");

    expect(finding.status).toBe("found");
    expect(finding.quote).toContain("automatically charged");
  });

  it("does not let the agent call small print the main page", () => {
    const report = subscription(LEGAL, {
      renewal: {
        quote: "You will be automatically charged $4.00 every 4 weeks",
        shown_where: "main_page",
        seen_at_step: 1,
      },
    });

    expect(pattern(report, "renewal_small_print").status).toBe("found");
  });

  it("finds the price jump in the same line", () => {
    const run = subscription(LEGAL, { price_after_intro: notShown });
    const finding = pattern(run, "intro_price_jump");

    expect(finding.status).toBe("found");
    expect(finding.amounts.map(({ amount }) => amount)).toEqual([4, 30]);
  });

  it("takes the page's own line when the agent tidied its quote off the page", () => {
    const report = subscription(LEGAL, {
      renewal: {
        quote: "Charged $4 every 4 weeks, then $30",
        shown_where: "fine_print",
        seen_at_step: 1,
      },
    });
    const finding = pattern(report, "renewal_small_print");

    expect(finding.status).toBe("found");
    expect(finding.quote).toContain("automatically charged");
  });

  it("does not call a price jump hidden when the later price is crossed out in view", () => {
    const html = `${LEGAL}<p><del>$30.00</del> <b>$4.00</b></p>`;
    const report = subscription(html, { price_after_intro: notShown });

    expect(pattern(report, "intro_price_jump").status).toBe("not_found");
  });

  it("stays quiet when the same line is also in the page's plain text", () => {
    const html = `${LEGAL}<p>You will be automatically charged $4.00 every 4 weeks.</p>`;

    expect(pattern(subscription(html, { renewal: notShown }), "renewal_small_print").status).toBe(
      "not_found",
    );
  });
});

describe("signals answered with seen or none seen", () => {
  function answering(extra: Record<string, unknown>) {
    return judge("blinkit-2", "checkout", (run) => {
      if (!run.result) return;
      Object.assign(
        run.result,
        { cart_item_count: 1, price_anchors: [], pattern_checks: [] },
        extra,
      );
    });
  }

  it("counts an explicit none seen as looked and clean", () => {
    const report = answering({ repeated_prompts: { status: "none_seen", items: [] } });

    expect(pattern(report, "nagging").status).toBe("not_found");
  });

  it("does not count seen with nothing listed as clean", () => {
    const empty = judge("blinkit-2", "checkout", (run) => {
      if (!run.result) return;
      Object.assign(run.result, {
        fees: run.result["fees"],
        added_without_asking: { status: "seen", items: [] },
      });
    });

    expect(pattern(empty, "basket_sneaking").status).toBe("not_checked");
  });

  it("believes the items over the word when the two disagree", () => {
    const item = { text: "Get the app for a better deal", seen_at_steps: [2, 4] };
    const report = answering({ repeated_prompts: { status: "none_seen", items: [item] } });

    expect(pattern(report, "nagging").status).toBe("found");
  });

  it("reads wrapped lists, keyed terms and keyed pattern checks", () => {
    const report = answering({
      price_anchors: {
        status: "seen",
        items: [{ quote: "Delivery charge", price: 499, reference_price: 999, seen_at_step: 2 }],
      },
      pattern_checks: {
        forced_action: {
          status: "seen",
          quote: "Add the insurance to continue",
          seen_at_step: 2,
          note: null,
        },
        disguised_ad: { status: "none_seen", quote: null, seen_at_step: null, note: null },
      },
    });

    expect(pattern(report, "reference_price").status).toBe("found");
    expect(pattern(report, "forced_action").quote).toBe("Add the insurance to continue");
    expect(pattern(report, "disguised_ad").status).toBe("not_found");
  });

  it("reads keyed terms into the subscription facts", () => {
    const report = judge("spotify-subscription", "subscription", (run) => {
      if (!run.result) return;
      run.result["terms"] = {
        renewal: { quote: "Renews automatically", shown_where: "fine_print", seen_at_step: 2 },
        trial: { quote: null, shown_where: "not_shown", seen_at_step: null },
      };
    });

    expect(report.subscription?.terms.map(({ term }) => term)).toEqual(["renewal", "trial"]);
    expect(pattern(report, "renewal_small_print").quote).toBe("Renews automatically");
  });
});

describe("a claim seen before the run stopped", () => {
  it("keeps a shaming decline button seen ahead of the bill", () => {
    const report = judge("spotify-subscription", "subscription", (run) => {
      if (!run.result) return;
      run.result["decline_wording"] = {
        status: "seen",
        items: [{ text: "No thanks, I don't want to save", seen_at_step: 1 }],
      };
    });

    expect(report.stop.reach).not.toBe("order");
    expect(pattern(report, "confirmshaming").status).toBe("found");
  });

  it("still says not checked when nothing was seen before the stop", () => {
    const report = judge("spotify-subscription", "subscription");

    expect(pattern(report, "confirmshaming").status).toBe("not_checked");
    expect(pattern(report, "confirmshaming").note).toMatch(/before/i);
  });

  it("still never calls an unreached pattern not found", () => {
    const report = judge("spotify-subscription", "subscription");

    expect(pattern(report, "hidden_subscription").status).toBe("not_checked");
    expect(pattern(report, "cancellation_terms_missing").status).toBe("not_checked");
  });
});

describe("an older audit, saved before pages were kept", () => {
  const older = (name: string, flow: Flow = "checkout") =>
    judgeRun({ flow, url: "https://example.test/", run: loadRun(name) });

  it("says so", () => {
    expect(older("blinkit-2").older).toBe(true);
    expect(judge("blinkit-2").older).toBe(false);
  });

  it("keeps a finding the sums settle, with the step's screenshot", () => {
    const drip = pattern(older("blinkit-2"), "drip_pricing");

    expect(drip.status).toBe("found");
    expect(drip.amounts.length).toBeGreaterThan(0);
    expect(drip.screenshot).not.toBeNull();
  });

  it("marks a quote it cannot match instead of showing nothing", () => {
    const fee = pattern(older("adobe-subscription", "subscription"), "cancellation_fee");

    expect(fee.status).toBe("not_checked");
    expect(fee.quote).toBeNull();
    expect(fee.note).toMatch(/older audit/i);
  });

  it("shows a quote the saved step text does hold", () => {
    const report = judgeRun({
      flow: "subscription",
      url: "https://example.test/",
      run: (() => {
        const run = loadRun("adobe-subscription");
        const [first] = run.steps;
        if (first) first.action = "Read the line: Cancel anytime by calling us on the helpline";
        const terms = run.result?.["terms"] as { term: string; quote: string | null }[];
        const term = terms.find((entry) => entry.term === "cancellation");
        if (term) term.quote = "Cancel anytime by calling us on the helpline";
        return run;
      })(),
    });

    expect(pattern(report, "hard_to_cancel").status).toBe("found");
  });

  it("does not take a quote with amounts on the strength of the sums", () => {
    const jump = pattern(older("adobe-subscription", "subscription"), "intro_price_jump");

    expect(jump.status).toBe("not_checked");
  });

  describe("whose run can no longer be read", () => {
    const report = () => judgeSavedReport(judge("blinkit-2"));

    it("keeps what the saved bill shows and marks the rest", () => {
      const { patterns, older: isOlder, rules } = report();
      const { status, amounts, screenshot } = pattern({ patterns } as SiteReport, "drip_pricing");

      expect(isOlder).toBe(true);
      expect(rules).toBe(RULES_VERSION);
      expect(status).toBe("found");
      expect(amounts.length).toBeGreaterThan(0);
      expect(screenshot).not.toBeNull();
    });

    it("claims no quote it can no longer check", () => {
      const others = report().patterns.filter(({ id }) => id !== "drip_pricing");

      expect(others.every(({ status }) => status === "not_checked")).toBe(true);
      expect(others.every(({ note }) => /older audit/i.test(note))).toBe(true);
    });

    it("keeps no finding when the saved bill does not add up", () => {
      const saved = judge("blinkit-2");
      saved.bill.addsUp = false;

      expect(pattern(judgeSavedReport(saved), "drip_pricing").status).toBe("not_checked");
    });
  });
});

describe("a plan with no commitment", () => {
  it.each([
    [null, true],
    ["None", true],
    ["No commitment", true],
    ["Cancel anytime, no fee", true],
    ["No refund if you cancel after Nov 16", false],
    ["12 months", false],
  ])("reads %s as %s", (commitment, expected) => {
    expect(isNoCommitment(commitment)).toBe(expected);
  });
});

describe("which screenshot a finding shows", () => {
  it("prefers a step that read the page over one caught mid-navigation", () => {
    const run = loadRun("adobe-subscription");
    const terms = run.result?.["terms"] as { term: string; quote: string | null }[];
    const quote = terms.find(({ term }) => term === "cancellation_fee")?.quote ?? "";
    const [moving, reading] = run.steps;
    if (!moving || !reading) throw new Error("no steps");
    moving.action = "Open the plan details page";
    reading.action = "Get full plan details and terms text";
    const captures = [moving, reading].map(({ id }) => ({
      stepId: id,
      text: htmlToText(`<p>${quote}</p>`),
    }));
    const report = judgeRun({ flow: "subscription", url: "https://example.test/", run, captures });

    expect(pattern(report, "cancellation_fee").screenshot?.stepId).toBe(reading.id);
  });
});

describe("a cancellation fee", () => {
  it("belongs to a subscription, so a flight's fare rule does not count", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (!run.result) return;
      run.result["terms"] = {
        cancellation_fee: {
          quote: "Delivery charge fee if you cancel",
          shown_where: "main_page",
          seen_at_step: 1,
        },
      };
    });

    expect(pattern(report, "cancellation_fee").status).not.toBe("found");
  });
});

describe("what the pages say, read from the end of the walk first", () => {
  it("shows the message on the page deepest in the flow", () => {
    const run = loadRun("blinkit-2");
    const [home, cart] = [run.steps[1], run.steps[3]];
    if (!home || !cart) throw new Error("no steps");
    const captures = [
      capturePage(home.id, "<p>Only 9 left</p>"),
      capturePage(cart.id, "<p>Only 2 left</p>"),
    ];
    const report = judgeRun({ flow: "checkout", url: "https://example.test/", run, captures });

    expect(pattern(report, "scarcity_message").quote).toBe("Only 2 left");
  });
});

describe("a card asked for a free trial", () => {
  const trial = (terms: Record<string, unknown>) =>
    judge("spotify-subscription", "subscription", (run) => {
      if (run.result) run.result["terms"] = terms;
    });
  const card = { quote: "Credit card required.", shown_where: "fine_print", seen_at_step: 1 };

  it("needs a free trial on offer", () => {
    const free = { quote: "1 month Free", shown_where: "main_page", seen_at_step: 1 };

    expect(pattern(trial({ trial_card: card, trial: free }), "trial_needs_card").status).toBe(
      "found",
    );
  });

  it("does not count a card for a plan with no trial", () => {
    const none = { quote: null, shown_where: "not_shown", seen_at_step: null };

    expect(pattern(trial({ trial_card: card, trial: none }), "trial_needs_card").status).not.toBe(
      "found",
    );
  });
});

describe("a page saved without a screenshot", () => {
  it("is passed over for the page that has one", () => {
    const run = loadRun("adobe-subscription");
    const terms = run.result?.["terms"] as { term: string; quote: string | null }[];
    const quote = terms.find(({ term }) => term === "cancellation_fee")?.quote ?? "";
    const [first, second] = run.steps;
    if (!first || !second) throw new Error("no steps");
    first.screenshot = null;
    const captures = [
      { stepId: first.id, text: htmlToText(`<p>${quote}</p>`) },
      { stepId: second.id, text: htmlToText(`<p>Some header words.</p><p>${quote}</p>`) },
    ];
    const report = judgeRun({ flow: "subscription", url: "https://example.test/", run, captures });

    expect(pattern(report, "cancellation_fee").screenshot?.stepId).toBe(second.id);
  });
});

describe("the evidence gate", () => {
  function gated(captures: PageCapture[]) {
    const run = loadRun("adobe-subscription");
    return judgeRun({ flow: "subscription", url: "https://example.test/", run, captures });
  }
  const fee = "Fee applies of half your remaining annual commitment if you cancel after Nov 14";

  function feeQuote(): string {
    const run = loadRun("adobe-subscription");
    const terms = (run.result?.["terms"] ?? []) as { term: string; quote: string | null }[];
    return terms.find(({ term }) => term === "cancellation_fee")?.quote ?? fee;
  }

  function shotOf(index: number): string {
    const step = loadRun("adobe-subscription").steps[index];
    if (!step) throw new Error("no such step");
    return step.id;
  }

  it("shows a finding whose words are on a captured page, with that page's screenshot", () => {
    const stepId = shotOf(5);
    const finding = pattern(
      gated([{ stepId, text: htmlToText(`<p>${feeQuote()}</p>`) }]),
      "cancellation_fee",
    );

    expect(finding.status).toBe("found");
    expect(finding.screenshot?.stepId).toBe(stepId);
    expect(finding.step).not.toBeNull();
  });

  it("does not show a finding whose words are on no captured page", () => {
    const finding = pattern(
      gated([{ stepId: shotOf(5), text: htmlToText("<p>nothing relevant</p>") }]),
      "cancellation_fee",
    );

    expect(finding.status).toBe("not_checked");
    expect(finding.quote).toBeNull();
    expect(finding.note).not.toMatch(/quote|capture|text/i);
  });

  it("shows no finding at all when the run saved no pages", () => {
    const report = gated([]);

    expect(report.patterns.filter(({ status }) => status === "found")).toEqual([]);
  });

  it("shows no finding when the page has no screenshot", () => {
    const finding = pattern(
      gated([{ stepId: "unknown", text: htmlToText(`<p>${feeQuote()}</p>`) }]),
      "cancellation_fee",
    );

    expect(finding.status).toBe("not_checked");
  });

  it("keeps nothing about the checks in the report", () => {
    const finding = pattern(judge("blinkit-2"), "drip_pricing");

    expect(Object.keys(finding).toSorted()).toEqual(
      [
        "amounts",
        "group",
        "id",
        "label",
        "note",
        "quote",
        "screenshot",
        "severity",
        "soFar",
        "status",
        "step",
      ].toSorted(),
    );
  });
});

describe("subscriptions", () => {
  const adobe = () => judge("adobe-subscription", "subscription");

  it("flags the cancellation fee first seen after the price it changes", () => {
    const fee = pattern(adobe(), "cancellation_fee");

    expect(fee.status).toBe("found");
    expect(fee.quote).toMatch(/half your remaining annual commitment/);
    expect(fee.step).toBe(2);
    expect(fee.note).toMatch(/after the price/i);
    expect(fee.severity).toBe("high");
  });

  it("does not take the words no cancellation fee for a fee", () => {
    const report = judge("adobe-subscription", "subscription", (run) => {
      if (run.result) {
        run.result["terms"] = [
          {
            term: "cancellation_fee",
            quote: "No cancellation fee",
            shown_where: "main_page",
            seen_at_step: 2,
          },
        ];
      }
    });

    expect(pattern(report, "cancellation_fee").status).toBe("not_found");
  });

  it.each([
    ["To cancel, call our support line on 1800 000", "found"],
    ["Cancel by sending written notice to our office", "found"],
    ["Cancel anytime online in your account settings", "not_found"],
    ["Cancel anytime", "not_found"],
  ])("reads the cancellation term %s as %s", (quote, status) => {
    const report = judge("adobe-subscription", "subscription", (run) => {
      if (run.result) {
        run.result["terms"] = [
          { term: "cancellation", quote, shown_where: "fine_print", seen_at_step: 2 },
        ];
      }
    });

    expect(pattern(report, "hard_to_cancel").status).toBe(status);
  });

  it.each([
    ["fine_print", "found"],
    ["info_icon", "found"],
    ["faq", "found"],
    ["later_page", "found"],
    ["main_page", "not_found"],
  ])("reads a renewal shown at %s as %s", (shownWhere, status) => {
    const report = judge("adobe-subscription", "subscription", (run) => {
      if (run.result) {
        run.result["terms"] = [
          {
            term: "renewal",
            quote: "Renews automatically each year",
            shown_where: shownWhere,
            seen_at_step: 2,
          },
        ];
      }
    });

    expect(pattern(report, "renewal_small_print").status).toBe(status);
  });

  it("finds an intro price whose later price is out of plain view", () => {
    const report = (shownWhere: string) =>
      judge("adobe-subscription", "subscription", (run) => {
        if (!run.result) return;
        run.result["intro_price"] = 99;
        run.result["price_after_intro"] = 799;
        run.result["terms"] = [
          {
            term: "price_after_intro",
            quote: "Then 799 a month",
            shown_where: shownWhere,
            seen_at_step: 2,
          },
        ];
      });

    expect(pattern(report("fine_print"), "intro_price_jump").status).toBe("found");
    expect(pattern(report("fine_print"), "intro_price_jump").amounts).toEqual([
      { label: "First price", amount: 99 },
      { label: "Price after the offer", amount: 799 },
    ]);
    expect(pattern(report("main_page"), "intro_price_jump").status).toBe("not_found");
  });

  it("does not let the required account count as forced action", () => {
    expect(pattern(adobe(), "forced_action").status).toBe("not_found");
  });

  it("counts marketing consent tied to Continue, not as an account matter", () => {
    const quote =
      'By clicking "Continue", I agree that Adobe family of companies can keep me informed by sending personalized emails about products and services.';
    const finding = pattern(
      judge("adobe-subscription", "subscription", (run) => {
        if (run.result) {
          run.result["consent_text"] = [
            { text: quote, seen_at_step: 4, can_decline_separately: false },
          ];
        }
      }),
      "forced_consent",
    );

    expect(finding.status).toBe("found");
    expect(finding.quote).toBe(quote);
    expect(finding.step).toBe(4);
  });

  it("ignores consent the buyer can decline with its own checkbox", () => {
    const finding = pattern(
      judge("adobe-subscription", "subscription", (run) => {
        if (run.result) {
          run.result["consent_text"] = [
            { text: "Send me marketing emails", seen_at_step: 4, can_decline_separately: true },
          ];
        }
      }),
      "forced_consent",
    );

    expect(finding.status).toBe("not_found");
  });

  it("finds a pre-ticked marketing box and a pre-ticked paid extra apart", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      if (run.result) {
        run.result["pre_ticked_options"] = [
          { label: "Send me offers and newsletters", cost: null, seen_at_step: 3 },
          { label: "Trip protection plan", cost: 299, seen_at_step: 3 },
          { label: "Standard delivery", cost: 25, seen_at_step: 3 },
        ];
      }
    });

    expect(pattern(report, "preticked_consent").quote).toBe("Send me offers and newsletters");
    expect(pattern(report, "preselected_extra").quote).toBe("Trip protection plan");
  });

  it("keeps GST inside the first price and finds no drip so far on Adobe", () => {
    const report = adobe();
    const drip = pattern(report, "drip_pricing");

    expect(report.bill.firstPrice).toBe(1199);
    expect(report.bill.total).toBe(1199);
    expect(report.bill.addsUp).toBe(true);
    expect(report.bill.charges).toEqual([]);
    expect(drip.status).toBe("not_found");
    expect(drip.soFar).toBe(true);
  });

  it("works out the contract and renewal totals", () => {
    const { subscription } = adobe();

    expect(subscription?.contractTotal).toBe(14388);
    expect(subscription?.renewalTotal).toBe(32568);
    expect(subscription?.renewalMultiple).toBeCloseTo(2.26, 2);
  });

  it("does not take a plan price for a final price when no bill was shown", () => {
    const report = judge("amazon-prime-subscription", "subscription");

    expect(report.bill.total).toBeNull();
    expect(report.bill.firstPrice).toBe(399);
    expect(report.priceLabel).toBe("none");
  });

  it("does not settle anything from the failed Adobe run", () => {
    const report = judge("adobe-subscription-incomplete", "subscription");

    expect(report.stop.at).toBe("incomplete");
    expect(report.bill.total).toBeNull();
    expect(pattern(report, "hidden_subscription").status).toBe("not_checked");
  });

  it("says the price is hidden on LinkedIn", () => {
    const report = judge("linkedin-subscription", "subscription");

    expect(report.login.hidesFees).toBe(true);
    expect(pattern(report, "drip_pricing").note).toMatch(/price/i);
    expect(report.bill.currency).toBeNull();
  });

  it("drops the Spotify tax line that has no amount", () => {
    expect(judge("spotify-subscription", "subscription").bill.charges).toEqual([]);
  });

  it("shows every billing option", () => {
    const { subscription } = judge("adobe-subscription", "subscription", (run) => {
      if (run.result) {
        run.result["plan_options"] = [
          {
            label: "Annual, billed monthly",
            price: 1199,
            period: "month",
            commitment: "12 months",
            fee_line: "Fee applies of half your remaining annual commitment",
            selected_by_default: true,
            first_seen_at_step: 1,
          },
          {
            label: "Monthly",
            price: 4071,
            period: "month",
            commitment: null,
            fee_line: "Cancel anytime, no fee",
            selected_by_default: false,
            first_seen_at_step: 2,
          },
        ];
      }
    });

    expect(subscription?.options).toHaveLength(2);
    expect(subscription?.noCommitmentPrice).toBe(4071);
  });

  const plans = (run: RunRecord) => {
    if (run.result) {
      run.result["plan_options"] = [
        {
          label: "Annual",
          price: 100,
          period: "month",
          commitment: "12 months",
          selected_by_default: true,
          first_seen_at_step: 1,
        },
        {
          label: "Monthly",
          price: 300,
          period: "month",
          commitment: null,
          selected_by_default: false,
          first_seen_at_step: 2,
        },
      ];
    }
  };

  it("flags a committed plan pre-selected over a plan with no commitment", () => {
    const finding = pattern(
      judge("spotify-subscription", "subscription", plans),
      "preselected_plan",
    );

    expect(finding.status).toBe("found");
    expect(finding.step).toBe(1);
  });

  describe("at the payment page", () => {
    const payment = (run: RunRecord) => {
      if (!run.result) return;
      Object.assign(run.result, {
        stopped_at: "payment_page",
        final_price: 1199,
        bill_itemised: true,
        stop_note: null,
        plan_name: "Annual plan",
        terms: [],
        steps: [
          { step: 1, page: "Plans", price_shown: 1199, note: "Plan list", url: null },
          { step: 2, page: "Order summary", price_shown: 1199, note: "Bill", url: null },
          { step: 3, page: "Payment method", price_shown: 1199, note: "Pick a card", url: null },
        ],
      });
    };
    const withPages = (html: string) => {
      const run = loadRun("adobe-subscription");
      payment(run);
      const captures = capturedEverywhere(run).map((capture) => ({
        ...capture,
        text: htmlToText(html),
      }));
      return judgeRun({ flow: "subscription", url: "https://example.test/", run, captures });
    };

    it("finds a subscription with no renewal wording on any page", () => {
      const report = withPages("<p>Annual plan</p><p>Pay now</p>");

      expect(pattern(report, "hidden_subscription").status).toBe("found");
      expect(pattern(report, "cancellation_terms_missing").status).toBe("found");
    });

    it("clears both as soon as any page has the wording", () => {
      const report = withPages("<p>Annual plan</p><p>Renews every year. Cancel anytime.</p>");

      expect(pattern(report, "hidden_subscription").status).toBe("not_found");
      expect(pattern(report, "cancellation_terms_missing").status).toBe("not_found");
    });
  });
});

describe("blocked and failed runs", () => {
  it("reports a site that never loaded as incomplete, with nothing claimed", () => {
    const report = judge("blinkit-page-never-loaded");

    expect(report.stop.at).toBe("incomplete");
    expect(report.stop.reach).toBe("pages");
    expect(report.bill.total).toBeNull();
    expect(report.login.offerSignIn).toBe(false);
    expect(report.patterns.some((entry) => entry.status === "found")).toBe(false);
    expect(report.patterns.find((entry) => entry.id === "drip_pricing")?.status).toBe(
      "not_checked",
    );
  });

  it("reports Ajio as blocked with nothing on the bill", () => {
    const report = judge("ajio");

    expect(report.stop.at).toBe("blocked");
    expect(report.bill.total).toBeNull();
    expect(pattern(report, "drip_pricing").status).toBe("not_checked");
  });

  it("flags a browser the agent reconfigured", () => {
    expect(judge("ajio").flags.map((flag) => flag.kind)).toContain("browser_changed");
    expect(judge("linkedin-subscription", "subscription").flags.map((flag) => flag.kind)).toContain(
      "browser_changed",
    );
    expect(judge("blinkit-2").flags).toEqual([]);
  });

  it("reports a cancelled run with no result as incomplete and says what is missing", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      run.status = "CANCELLED";
      run.result = null;
    });

    expect(report.stop.at).toBe("incomplete");
    expect(
      report.patterns.every(
        ({ status }) => status === "not_checked" || status === "not_applicable",
      ),
    ).toBe(true);
    expect(report.missing.join(" ")).toMatch(/stopped/i);
  });

  it("reports a failed run as an error", () => {
    const report = judge("blinkit-2", "checkout", (run) => {
      run.status = "FAILED";
      run.result = null;
    });

    expect(report.stop.at).toBe("error");
  });
});

describe("safety scan", () => {
  function withAction(action: string) {
    return judge("blinkit-2", "checkout", (run) => {
      run.steps.push({
        id: "typed",
        timestamp: "2026-10-31T08:27:50Z",
        status: "RUNNING",
        action,
        screenshot: null,
        duration: null,
      });
    });
  }

  it("flags typed contact details", () => {
    expect(withAction("Enter email test@test.com in the contact field").flags[0]?.kind).toBe(
      "contact_entered",
    );
    expect(withAction("Type phone number 9999999999").flags[0]?.kind).toBe("contact_entered");
  });

  function clickedThenReached(action: string, page: Record<string, unknown>) {
    return judge("blinkit-2", "checkout", (run) => {
      run.steps.push({
        id: "clicked",
        timestamp: "2026-10-31T08:27:50Z",
        status: "RUNNING",
        action,
        screenshot: null,
        duration: null,
      });
      const pages = (run.result?.["steps"] ?? []) as Record<string, unknown>[];
      pages.push({ step: pages.length + 1, price_shown: null, url: null, note: null, ...page });
    });
  }

  it("flags a payment click once a payment step was reached", () => {
    const methods = clickedThenReached("Click Place Order to finish", {
      page: "Payment method",
      note: "Card, UPI, wallet and cash on delivery offered.",
    });
    const provider = clickedThenReached("Click Pay now", {
      page: "Checkout",
      url: "https://checkout.stripe.com/c/pay/cs_live_a1",
    });
    const fields = clickedThenReached("Select Cash on Delivery as payment", {
      page: "Order",
      note: "Fields for card number, expiry date and CVV.",
    });

    for (const report of [methods, provider, fields]) {
      expect(report.flags.map(({ kind }) => kind)).toContain("payment_click");
    }
  });

  it("does not warn about a Pay button that only opened an order summary", () => {
    const report = clickedThenReached("Click Pay to proceed to checkout", {
      page: "Contact Details Page",
      url: "https://tickets.test/order-summary/ET1",
      note: "Contact Details popup requires email and mobile number. Price shown as 600 on Pay button.",
    });

    expect(report.flags.map(({ kind }) => kind)).not.toContain("payment_click");
  });

  it("leaves location entry and reading a form alone", () => {
    expect(withAction("Type delivery location Andheri with pincode").flags).toEqual([]);
    expect(withAction("Check email entry page details").flags).toEqual([]);
    expect(
      withAction("See full details of the sign-up page with mobile number input").flags,
    ).toEqual([]);
    expect(withAction("Close the payment offer popup").flags).toEqual([]);
  });
});

describe("step screenshots", () => {
  it("points the Blinkit drip finding at the cart bill step", () => {
    const drip = pattern(judge("blinkit-2"), "drip_pricing");

    expect(drip.screenshot?.action).toMatch(/cart/i);
    expect(drip.screenshot?.stepId).toBeTruthy();
  });

  it("points Adobe's cancellation fee at a checkout options step", () => {
    const fee = pattern(judge("adobe-subscription", "subscription"), "cancellation_fee");
    const run = loadRun("adobe-subscription");
    const index = run.steps.findIndex((step) => step.id === fee.screenshot?.stepId);

    expect(index).toBeGreaterThanOrEqual(13);
    expect(index).toBeLessThanOrEqual(16);
  });

  it("gives each page its own step, and never the final write-up", () => {
    const report = judge("blinkit-page-never-loaded");
    const shots = report.pages.map((page) => page.screenshot?.stepId);

    expect(new Set(shots).size).toBe(report.pages.length);
    for (const page of report.pages) {
      expect(page.screenshot?.action).not.toMatch(/^report findings/i);
    }
  });
});
