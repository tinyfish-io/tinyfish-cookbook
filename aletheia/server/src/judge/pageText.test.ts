import { describe, expect, it } from "vite-plus/test";

import { capturePage, htmlToText, locateQuote } from "./pageText.ts";

describe("htmlToText", () => {
  it("keeps visible text and drops scripts, styles and tags", () => {
    const text = htmlToText(
      "<html><style>.a{color:red}</style><script>var hidden = 1;</script><p>Hello <b>there</b></p></html>",
    );

    expect(text).toContain("hellothere");
    expect(text).not.toMatch(/hidden|color/);
  });

  it("decodes the entities sites use in copy", () => {
    expect(htmlToText("<p>Don&#39;t&nbsp;miss &amp; save</p>")).toBe("don'tmiss&save");
  });
});

describe("htmlToText on real pages", () => {
  it("decodes numeric entities, the form most sites write", () => {
    expect(htmlToText("<p>Don&#8217;t pay &#8377;99&#160;now &#x2014; &#x24;5</p>")).toBe(
      "don'tpay₹99now-$5",
    );
  });

  it("reads the words a button or image keeps in an attribute", () => {
    const text = htmlToText(
      `<input type="submit" value="No thanks, I hate saving"><button aria-label="Close offer"></button><img alt="Only 2 left">`,
    );

    expect(text).toContain("nothanks,ihatesaving");
    expect(text).toContain("closeoffer");
    expect(text).toContain("only2left");
  });

  it("never reads an attribute of a hidden input", () => {
    expect(htmlToText(`<input type="hidden" value="secret token"><p>Visible</p>`)).toBe("visible");
  });

  it("ignores invisible characters a site puts inside words", () => {
    expect(htmlToText("<p>Re­news au​to</p>")).toBe("renewsauto");
  });
});

describe("capturePage", () => {
  it("keeps the words for matching and what the page says for itself", () => {
    const page = capturePage("step", "<p>Only 2 left</p>");

    expect(page.stepId).toBe("step");
    expect(page.text).toBe("only2left");
    expect(page.signals?.pressure).toEqual([{ kind: "scarcity_message", text: "Only 2 left" }]);
  });
});

describe("locateQuote", () => {
  const pages = [
    { stepId: "first", text: htmlToText("<p>Choose a plan</p>") },
    {
      stepId: "second",
      text: htmlToText(
        `<div>Fee applies of <span>half your remaining</span> annual commitment</div>
         <button>No, I’ll risk it</button><p>Only <b>2</b> left – hurry</p><p>₹ 1,199.00/mo</p>`,
      ),
    },
  ];

  it("finds wording split across tags and lines, and names its page", () => {
    expect(locateQuote("Fee applies of half your remaining annual commitment", pages)).toBe(
      "second",
    );
  });

  it("ignores case, spacing and curly or straight punctuation", () => {
    expect(locateQuote("no, i'll RISK it", pages)).toBe("second");
    expect(locateQuote("Only 2 left - hurry", pages)).toBe("second");
    expect(locateQuote("₹1,199.00/mo", pages)).toBe("second");
  });

  it("reads an elided quote as its two sides, on one page, in order", () => {
    expect(locateQuote("Fee applies of half ... annual commitment", pages)).toBe("second");
    expect(locateQuote("Fee applies of half … annual commitment", pages)).toBe("second");
    expect(locateQuote("annual commitment ... Fee applies of half", pages)).toBeNull();
    expect(locateQuote("Choose a plan ... annual commitment", pages)).toBeNull();
    expect(locateQuote("Fee ... commitment", pages)).toBeNull();
  });

  it("picks the page where the words sit highest, since a screenshot shows only the top", () => {
    const low = { stepId: "low", text: `${"x".repeat(5000)}only2left` };
    const high = { stepId: "high", text: "header only2left" };

    expect(locateQuote("Only 2 left", [low, high])).toBe("high");
  });

  it("still prefers the page the agent named", () => {
    const named = { stepId: "named", text: `${"x".repeat(5000)}only2left` };
    const other = { stepId: "other", text: "only2left" };

    expect(locateQuote("Only 2 left", [other, named], "named")).toBe("named");
  });

  it("ignores punctuation an agent adds at the ends of a quote", () => {
    const page = [{ stepId: "page", text: htmlToText("<p>Fee applies after Nov 16</p>") }];

    expect(locateQuote("Fee applies after Nov 16.", page)).toBe("page");
    expect(locateQuote('"Fee applies after Nov 16"', page)).toBe("page");
    expect(locateQuote("Fee applies after Nov 17.", page)).toBeNull();
  });

  it("does not accept a paraphrase", () => {
    expect(locateQuote("a fee of half the remaining commitment", pages)).toBeNull();
  });

  it("does not accept a word too short to mean anything", () => {
    expect(locateQuote("a", pages)).toBeNull();
    expect(locateQuote("  ", pages)).toBeNull();
  });

  it("prefers the page the agent named when the wording is on it", () => {
    const twice = [
      { stepId: "one", text: htmlToText("<p>Only 2 left</p>") },
      { stepId: "two", text: htmlToText("<p>Only 2 left</p>") },
    ];

    expect(locateQuote("Only 2 left", twice)).toBe("one");
    expect(locateQuote("Only 2 left", twice, "two")).toBe("two");
  });

  it("finds nothing when no page was captured", () => {
    expect(locateQuote("anything", [])).toBeNull();
  });
});
