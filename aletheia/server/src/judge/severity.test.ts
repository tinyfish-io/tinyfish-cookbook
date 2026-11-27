import { describe, expect, it } from "vite-plus/test";

import { PATTERNS } from "./patterns.ts";
import { rankFindings, severitySummary } from "./severity.ts";
import type { PatternFinding, PatternId, PatternStatus, ShownWhere, Term } from "./types.ts";

function finding(id: PatternId, status: PatternStatus = "found", quote: string | null = null) {
  const definition = PATTERNS.find((entry) => entry.id === id);
  if (!definition) throw new Error(`No pattern ${id}`);
  const { label, group, severity } = definition;
  return {
    id,
    label,
    group,
    severity,
    status,
    soFar: false,
    step: 2,
    quote,
    amounts: [],
    screenshot: null,
    note: "",
  } satisfies PatternFinding;
}

function term(name: Term["term"], shownWhere: ShownWhere): Term {
  return { term: name, quote: "words", shownWhere, seenAtStep: 2 };
}

const report = (patterns: PatternFinding[], terms: Term[] = []) => ({
  patterns,
  subscription: terms.length > 0 ? { terms } : null,
});

describe("the severity of each pattern", () => {
  it("follows the research: money or a binding commitment is high", () => {
    const high = PATTERNS.filter(({ severity }) => severity === "high").map(({ id }) => id);
    expect(high).toEqual([
      "drip_pricing",
      "bait_and_switch",
      "free_claim",
      "basket_sneaking",
      "preselected_extra",
      "hidden_subscription",
      "cancellation_fee",
      "hard_to_cancel",
      "forced_action",
    ]);
  });

  it("keeps low for pressure or framing only", () => {
    const low = PATTERNS.filter(({ severity }) => severity === "low").map(({ id }) => id);
    expect(low).toEqual(["reference_price", "activity_message"]);
  });
});

describe("rankFindings", () => {
  it("keeps only what was found, worst first", () => {
    const ranked = rankFindings([
      finding("reference_price"),
      finding("countdown", "not_found"),
      finding("forced_consent"),
      finding("drip_pricing", "not_checked"),
      finding("cancellation_fee"),
    ]);
    expect(ranked.map(({ id }) => id)).toEqual([
      "cancellation_fee",
      "forced_consent",
      "reference_price",
    ]);
  });

  it("keeps the taxonomy's order within one level", () => {
    const ranked = rankFindings([
      finding("nagging"),
      finding("countdown"),
      finding("confirmshaming"),
    ]);
    expect(ranked.map(({ id }) => id)).toEqual(["countdown", "confirmshaming", "nagging"]);
  });
});

describe("severitySummary", () => {
  it("counts each level and names the worst findings in plain words", () => {
    const summary = severitySummary(
      report(
        [
          finding("cancellation_fee"),
          finding(
            "forced_consent",
            "found",
            'By clicking "Continue", I agree that we can send you personalised emails.',
          ),
          finding("hard_to_cancel"),
        ],
        [term("cancellation_fee", "fine_print")],
      ),
    );
    expect(summary).toEqual({
      high: 2,
      medium: 1,
      low: 0,
      line: "2 high, 1 medium: a cancellation fee in the fine print, no way to cancel online and 1 more",
    });
  });

  it("names the button that marketing consent is tied to", () => {
    const { line } = severitySummary(
      report([
        finding("forced_consent", "found", "By pressing “Create account” you agree to offers"),
      ]),
    );
    expect(line).toBe("1 medium: marketing consent tied to Create account");
  });

  it("says plainly when consent is tied to going on without a named button", () => {
    const { line } = severitySummary(
      report([finding("forced_consent", "found", "You agree to receive marketing")]),
    );
    expect(line).toBe("1 medium: marketing consent tied to going on");
  });

  it("joins two findings with and", () => {
    const { line } = severitySummary(report([finding("countdown"), finding("reference_price")]));
    expect(line).toBe("1 medium, 1 low: a countdown or deadline and a crossed-out price");
  });

  it("leaves the place out when the term was on the main page", () => {
    const { line } = severitySummary(
      report([finding("cancellation_fee")], [term("cancellation_fee", "main_page")]),
    );
    expect(line).toBe("1 high: a cancellation fee");
  });

  it("says where a term was tucked away", () => {
    const { line } = severitySummary(
      report([finding("intro_price_jump")], [term("price_after_intro", "info_icon")]),
    );
    expect(line).toBe("1 medium: an intro price that rises later behind an info icon");
  });

  it("has no line when nothing was found", () => {
    expect(severitySummary(report([finding("countdown", "not_found")]))).toEqual({
      high: 0,
      medium: 0,
      low: 0,
      line: null,
    });
  });

  it("has a plain phrase for every pattern", () => {
    for (const { id } of PATTERNS) {
      const { line } = severitySummary(report([finding(id)]));
      expect(line).toMatch(/^1 (high|medium|low): [a-z]/);
    }
  });
});
