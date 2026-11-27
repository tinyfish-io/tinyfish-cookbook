import { foundPatterns } from "./story.ts";
import type { AuditPublic } from "./types.ts";

/** A saved, shared audit that shows a newcomer what a report looks like. */
export const SAMPLE_REPORT_TOKEN = "hAsQ7yThlNCLvq8_7abW7n-mu33fzTpl";

const PILLS = 3;
const QUOTE_MAX = 140;

export interface SampleCard {
  host: string;
  /** The brand's own name, when the server knows it. */
  name: string | null;
  task: string;
  /** The worst findings by name. */
  pills: string[];
  more: number;
  quote: string | null;
  href: string;
}

export function sampleCard(audit: AuditPublic, token: string): SampleCard | null {
  const site = audit.sites.find((entry) => entry.report);
  if (!site?.report) return null;
  const findings = foundPatterns(site.report);
  if (findings.length === 0) return null;

  const quoted = findings.find(({ quote }) => quote && quote.length <= QUOTE_MAX);
  return {
    host: site.host,
    name: site.name,
    task: audit.task,
    pills: findings.slice(0, PILLS).map(({ label }) => label),
    more: Math.max(findings.length - PILLS, 0),
    quote: quoted?.quote ?? null,
    href: `/shared/${token}`,
  };
}
