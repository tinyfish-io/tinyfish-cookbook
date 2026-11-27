import { describe, expect, it } from "vite-plus/test";

import { readSignals } from "./pageSignals.ts";

describe("readSignals", () => {
  it("finds stock, demand, activity and deadline messages", () => {
    const { pressure } = readSignals(
      `<div><p>We have 1 left at this price</p><span>Only 3 rooms left!</span>
       <p>Selling fast</p><p>12 people are looking at this right now</p>
       <p>500+ bought in past month</p><b>Limited-time Deal</b><p>Offer ends in 2 days</p></div>`,
    );

    expect(pressure).toEqual(
      expect.arrayContaining([
        { kind: "scarcity_message", text: "We have 1 left at this price" },
        { kind: "scarcity_message", text: "Only 3 rooms left" },
        { kind: "high_demand", text: "Selling fast" },
        { kind: "activity_message", text: "12 people are looking at this right now" },
        { kind: "activity_message", text: "500+ bought in past month" },
        { kind: "countdown", text: "Limited-time Deal" },
        { kind: "countdown", text: "Offer ends in 2 days" },
      ]),
    );
  });

  it("reads a last-tickets tag as scarcity", () => {
    expect(readSignals("<span>Last tickets</span>").pressure).toEqual([
      { kind: "scarcity_message", text: "Last tickets" },
    ]);
  });

  it("does not take a menu section called Limited Time Only for a deadline", () => {
    expect(readSignals("<a>Limited Time Only!</a><p>Burgers</p>").pressure).toEqual([]);
  });

  it("reads a share of places already gone as scarcity", () => {
    const { pressure } = readSignals(
      "<p>80% of places to stay are unavailable for your dates on our site.</p>",
    );

    expect(pressure).toEqual([
      {
        kind: "scarcity_message",
        text: "80% of places to stay are unavailable for your dates",
      },
    ]);
  });

  it("does not take ordinary words for pressure", () => {
    const { pressure } = readSignals(
      `<p>Only 3 steps to set up. 5 stars. Left side of the page. 200 people work here.</p>
       <p>Free cancellation. Most popular. 4.5 out of 5 from 1,200 reviews.</p>`,
    );

    expect(pressure).toEqual([]);
  });

  it("does not take a fee's name for a demand message", () => {
    expect(readSignals("<p>High demand surge charge $3</p>").pressure).toEqual([]);
  });

  it("leaves out what the page hides", () => {
    const { pressure, preticked } = readSignals(
      `<div style="display:none"><p>Only 2 left</p><div><p>Selling fast</p></div></div>
       <section hidden><label><input type="checkbox" checked> Send me marketing offers</label></section>
       <p>Shown</p>`,
    );

    expect(pressure).toEqual([]);
    expect(preticked).toEqual([]);
  });

  it("reads each message once", () => {
    const { pressure } = readSignals("<p>Only 2 left</p><p>Only 2 left</p>");

    expect(pressure).toHaveLength(1);
  });

  it("reads a crossed-out price and the price after it", () => {
    const { anchors } = readSignals(
      `<p><del>$1,299.00</del> <strong>$999.00</strong></p>
       <p>Original price € 97. Current price € 80.</p>`,
    );

    expect(anchors).toEqual([
      { quote: "$1,299.00 $999.00", referencePrice: 1299, price: 999 },
      { quote: "Original price € 97. Current price € 80", referencePrice: 97, price: 80 },
    ]);
  });

  it("reads a price built from inline pieces as one price", () => {
    const price = (amount: string) =>
      `<span><span>US$</span><span>${amount}</span><span>.</span><span>99</span><span>/mo</span></span>`;
    const { anchors } = readSignals(
      `<div><span class="price-strikethrough">${price("69")}</span> ${price("34")}</div>`,
    );

    expect(anchors).toEqual([
      { quote: "US$69.99/mo US$34.99", referencePrice: 69.99, price: 34.99 },
    ]);
  });

  it("does not call a struck word or a lower struck price an anchor", () => {
    const { anchors } = readSignals("<s>old copy</s><p>$20</p><s>$10</s><p>$20</p>");

    expect(anchors).toEqual([]);
  });

  it("reads a fee split out of the price", () => {
    const { splitPrices } = readSignals(
      `<p>$120 + $25 resort fee</p><p>$45 + fees</p><p>€80 plus €4.50 service charge</p>`,
    );

    expect(splitPrices).toEqual([
      "$120 + $25 resort fee",
      "$45 + fees",
      "€80 plus €4.50 service charge",
    ]);
  });

  it("reads taxes and fees written with an ampersand", () => {
    expect(readSignals("<p>₹5,958 + ₹745 taxes &amp; fees</p>").splitPrices).toEqual([
      "₹5,958 + ₹745 taxes & fees",
    ]);
  });

  it("reads a fee set in the block under its price", () => {
    expect(
      readSignals("<p>₹5,958</p><p>+ ₹745 taxes &amp; fees, per night</p>").splitPrices,
    ).toEqual(["₹5,958 + ₹745 taxes & fees"]);
    expect(readSignals("<div>+ ₹745 taxes &amp; fees</div>").splitPrices).toEqual([
      "+ ₹745 taxes & fees",
    ]);
  });

  it("does not count tax on its own as a split fee", () => {
    expect(readSignals("<p>$120 + tax</p><p>$99 plus GST</p>").splitPrices).toEqual([]);
  });

  it("reads shaming wording only from a control", () => {
    const { declines } = readSignals(
      `<button>No thanks, I prefer paying full price</button><a href="#">No, I'll risk it</a>
       <button>Skip</button><p>I don't want this to happen to you.</p>`,
    );

    expect(declines).toEqual(["No thanks, I prefer paying full price", "No, I'll risk it"]);
  });

  it("reads a ticked marketing box and its label", () => {
    const { preticked } = readSignals(
      `<label><input type="checkbox" checked="checked"> Send me special offers by email</label>
       <input type="checkbox" checked aria-label="Personalized recommendations">
       <label><input type="checkbox"> Send me the newsletter</label>
       <label><input type="checkbox" checked> I accept the terms</label>`,
    );

    expect(preticked).toEqual(["Send me special offers by email", "Personalized recommendations"]);
  });

  describe("subscription terms", () => {
    const term = (html: string, name: string) =>
      readSignals(html).terms.filter((entry) => entry.term === name);

    it("reads renewal wording and says it sits in the fine print", () => {
      const html = `<div data-testid="legal-offer-section-basic"><p>Offer for new members. You will be
        automatically charged in advance $4.00 every 4 weeks for 1 year, and $30.00 every 4 weeks thereafter.</p></div>`;

      expect(term(html, "renewal")).toEqual([
        {
          term: "renewal",
          quote:
            "You will be automatically charged in advance $4.00 every 4 weeks for 1 year, and $30.00 every 4 weeks thereafter.",
          place: "fine_print",
        },
      ]);
    });

    it("knows plain wording from small print by the element it sits in", () => {
      expect(term("<p>Renews automatically each month.</p>", "renewal")[0]?.place).toBe(null);
      for (const html of [
        `<small>Renews automatically each month.</small>`,
        `<footer><p>Renews automatically each month.</p></footer>`,
        `<p class="Billboard__disclaimer section-disclaimer">Renews automatically each month.</p>`,
      ]) {
        expect(term(html, "renewal")[0]?.place).toBe("fine_print");
      }
    });

    it("tells a collapsed FAQ and a tooltip from fine print", () => {
      const faq = `<details><summary>Billing</summary><p>Renews automatically each month.</p></details>`;
      const tip = `<div class="tooltip-body"><p>Renews automatically each month.</p></div>`;

      expect(term(faq, "renewal")[0]?.place).toBe("faq");
      expect(term(tip, "renewal")[0]?.place).toBe("info_icon");
    });

    it("does not call a link to the legal page fine print", () => {
      const html = `<p><a href="/legal/terms">Renews automatically each month.</a></p>`;

      expect(term(html, "renewal")[0]?.place).toBe(null);
    });

    it("reads a cancellation fee but not the promise of none", () => {
      expect(
        term("<p>An early termination fee of $79 applies.</p>", "cancellation_fee"),
      ).toHaveLength(1);
      expect(term("<p>No cancellation fee.</p>", "cancellation_fee")).toEqual([]);
    });

    it("reads how to cancel, a trial, its card and the price after an offer", () => {
      const html = `<p>Cancel anytime in your account. Start your 7-day free trial today.
        A credit card is required for the trial. $6.49/month for a year, then $12.99/month.</p>`;

      expect(term(html, "cancellation")[0]?.quote).toBe("Cancel anytime in your account.");
      expect(term(html, "trial")[0]?.quote).toBe("Start your 7-day free trial today.");
      expect(term(html, "trial_card")[0]?.quote).toBe("A credit card is required for the trial.");
      expect(term(html, "price_after_intro")[0]?.quote).toBe(
        "$6.49/month for a year, then $12.99/month.",
      );
    });

    it("does not end a sentence at a price's period", () => {
      const html = "<p>Plan $99.99/mo. after a 3-day free trial unless canceled.</p>";

      expect(term(html, "renewal")[0]?.quote).toBe(
        "Plan $99.99/mo. after a 3-day free trial unless canceled.",
      );
    });

    it("leaves out a modal the page has not opened", () => {
      const html = `<div class="modal-wrapper modal-hide"><p>Renews automatically each month.</p></div>`;

      expect(term(html, "renewal")).toEqual([]);
    });
  });

  describe("a cookie banner", () => {
    it("is read when it has an accept button and no way to refuse", () => {
      const { cookieAccept } = readSignals(
        `<p>We use cookies.</p><button>Accept all cookies</button><button>Manage settings</button>`,
      );

      expect(cookieAccept).toBe("Accept all cookies");
    });

    it("is passed over when it can be refused", () => {
      const { cookieAccept } = readSignals(
        `<p>We use cookies.</p><button>Accept all</button><button>Reject all</button>`,
      );

      expect(cookieAccept).toBeNull();
    });

    it("needs the word cookie, since accept alone can mean anything", () => {
      expect(readSignals("<button>Accept</button>").cookieAccept).toBeNull();
    });

    it("does not take a survey answer far from a cookie link for a banner", () => {
      const footer = `<p>${"Plenty of other words on this page. ".repeat(40)}</p><a>Cookie policy</a>`;

      expect(
        readSignals(`<button>Agree</button><button>Neutral</button>${footer}`).cookieAccept,
      ).toBeNull();
    });
  });
});
