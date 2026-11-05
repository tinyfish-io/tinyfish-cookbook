import { hiddenCost, type HiddenCost } from "../../../server/src/judge/compare.ts";
import { money } from "./format.ts";
import type { AuditPublic, PatternId, PatternStatus, SiteReport } from "./types.ts";

export interface CompareColumn {
  key: string;
  auditId: string;
  host: string;
  task: string;
  report: SiteReport;
  hiddenCost: HiddenCost | null;
}

export interface PatternRow {
  id: PatternId;
  label: string;
  statuses: PatternStatus[];
}

export interface ComparisonView {
  columns: CompareColumn[];
  patternRows: PatternRow[];
  /** Prices earn a place beside the patterns only when one of them moved. */
  pricesMoved: boolean;
  notes: string[];
}

export function hiddenCostLabel(cost: HiddenCost | null, currency: string | null): string {
  if (cost === null) return "Unknown";
  const sign = cost.amount < 0 ? "-" : "+";
  const parts = [`${sign}${money(Math.abs(cost.amount), currency)}`];
  if (cost.amount !== 0 && cost.percent !== null) parts.push(`${sign}${Math.abs(cost.percent)}%`);
  return parts.join(", ") + (cost.final ? "" : " so far");
}

function patternRows(columns: readonly CompareColumn[]): PatternRow[] {
  const first = columns[0];
  if (!first) return [];
  return first.report.patterns.map(({ id, label }) => ({
    id,
    label,
    statuses: columns.map(
      (column) => column.report.patterns.find((entry) => entry.id === id)?.status ?? "not_checked",
    ),
  }));
}

export function buildComparison(audits: readonly AuditPublic[]): ComparisonView {
  const comparison = audits.length === 1 ? audits[0]?.comparison : null;

  const columns = audits.flatMap((audit) =>
    audit.sites.flatMap((site) =>
      site.report
        ? [
            {
              key: site.id,
              auditId: audit.id,
              host: site.host,
              task: audit.task,
              report: site.report,
              hiddenCost: hiddenCost(site.report),
            },
          ]
        : [],
    ),
  );

  const unreported = audits.flatMap((audit) =>
    audit.sites
      .filter((site) => !site.report)
      .map((site) => `${site.host} has no report to compare.`),
  );
  const notes = [
    ...(audits.length > 1
      ? ["These are separate audits, so their prices are not like for like."]
      : []),
    ...(comparison?.reasons ?? []),
    ...unreported,
  ];

  return {
    columns,
    patternRows: patternRows(columns),
    pricesMoved: columns.some(({ hiddenCost: cost }) => (cost?.amount ?? 0) > 0),
    notes,
  };
}
