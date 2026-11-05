import { describe, expect, it } from "vite-plus/test";

import { finding, report } from "../testing/report.ts";
import type { PatternFinding } from "./types.ts";
import { SAMPLE_REPORT_TOKEN, sampleCard } from "./sample.ts";
import type { AuditPublic, SiteView } from "./types.ts";

const LONG_QUOTE =
  'By clicking "Continue", I agree that the company and its family of companies can keep me informed by sending personalised emails about products and services, and offers from partners.';

function site(patterns: PatternFinding[]): SiteView {
  return {
    id: "s1",
    url: "https://plans.test/",
    host: "plans.test",
    name: null,
    signedIn: false,
    state: "done",
    queuePosition: null,
    runId: "run_1",
    streamingUrl: null,
    steps: [],
    startedAt: null,
    finishedAt: null,
    report: report({ host: "plans.test", flow: "subscription", patterns }),
    error: null,
    logout: null,
  };
}

function audit(sites: SiteView[]): AuditPublic {
  return {
    id: "a1",
    task: "Sign up for a design plan",
    flow: "subscription",
    createdAt: "2026-11-02T12:50:00.000Z",
    status: "finished",
    sites,
    countryName: null,
    comparison: null,
  };
}

const found = [
  finding({ id: "reference_price", label: "Crossed-out price", severity: "low", status: "found" }),
  finding({ id: "preselected_plan", label: "Longer plan pre-selected", status: "found" }),
  finding({
    id: "cancellation_fee",
    label: "Cancellation fee",
    severity: "high",
    status: "found",
    quote: "Fee applies if you cancel after 14 days.",
  }),
  finding({ id: "forced_consent", label: "Forced marketing consent", status: "found" }),
];

describe("sampleCard", () => {
  it("names the site, the task and the worst findings, and links to the shared report", () => {
    expect(sampleCard(audit([site(found)]), "tok")).toEqual({
      host: "plans.test",
      name: null,
      task: "Sign up for a design plan",
      pills: ["Cancellation fee", "Longer plan pre-selected", "Forced marketing consent"],
      more: 1,
      quote: "Fee applies if you cancel after 14 days.",
      href: "/shared/tok",
    });
  });

  it("quotes the worst finding that has a short enough quote", () => {
    const patterns = [
      finding({
        id: "forced_action",
        label: "Forced action",
        severity: "high",
        status: "found",
        quote: LONG_QUOTE,
      }),
      finding({
        id: "countdown",
        label: "Countdown",
        status: "found",
        quote: "Offer ends tonight",
      }),
    ];
    expect(sampleCard(audit([site(patterns)]), "tok")?.quote).toBe("Offer ends tonight");
  });

  it("is left out when the report found nothing", () => {
    expect(sampleCard(audit([site([])]), "tok")).toBeNull();
  });

  it("is left out when no site has a report", () => {
    expect(sampleCard(audit([{ ...site(found), report: null, state: "running" }]), "tok")).toBe(
      null,
    );
  });

  it("points at the saved sample", () => {
    expect(SAMPLE_REPORT_TOKEN).toBe("hAsQ7yThlNCLvq8_7abW7n-mu33fzTpl");
  });
});
