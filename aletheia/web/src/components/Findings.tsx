import type { ReportScope } from "../lib/api.ts";
import { screenshotUrl } from "../lib/api.ts";
import { money } from "../lib/format.ts";
import { counts, severityLine, tallyLine } from "../lib/report.ts";
import { billNote, foundPatterns, showsBill, story } from "../lib/story.ts";
import type { Story } from "../lib/story.ts";
import type { PatternFinding, SiteReport } from "../lib/types.ts";
import { Receipt } from "./Receipt.tsx";
import { Screenshot } from "./Screenshot.tsx";
import { Pill, SeverityTag, StatusPill } from "./ui.tsx";

export function findingAnchor(siteId: string, id: PatternFinding["id"]): string {
  return `finding-${siteId}-${id}`;
}

const PANEL: Record<Story["tone"], string> = {
  found: "from-[#fff1e6] to-[#fff7f1]",
  open: "from-[#e6f2ff] to-[#f3f9ff]",
  clear: "from-[#e4faec] to-[#f2fdf6]",
};

/**
 * The white card in the report's pastel panel: how bad in one line, the count, then each pattern
 * found, worst first, with its level and step.
 */
export function FindingsSummary({ report, siteId }: { report: SiteReport; siteId: string }) {
  const findings = foundPatterns(report);
  const line = severityLine(report);
  return (
    <div
      className={`overflow-hidden rounded-panel bg-linear-to-b p-4 sm:p-10 ${PANEL[story(report).tone]}`}
    >
      <div className="card px-4 py-5 sm:px-6 sm:py-6">
        {line ? (
          <p className="num mb-1.5 text-[17px]/[1.35] font-semibold tracking-[-0.01em] text-ink">
            {line}
          </p>
        ) : null}
        <p className="num text-[13px] text-mute">{tallyLine(counts(report))}</p>
        {findings.length > 0 ? (
          <ul className="mt-2">
            {findings.map(({ id, label, step, severity }) => (
              <li key={id}>
                <a
                  href={`#${findingAnchor(siteId, id)}`}
                  className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-xl bg-peach px-3.5 py-2 font-medium text-ink transition-colors hover:bg-peach-line"
                >
                  <span className="min-w-0">{label}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <SeverityTag severity={severity} />
                    {step === null ? null : (
                      <span className="num text-[13px] font-normal text-body">Step {step}</span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-mute">
            No dark pattern was seen on the pages this run reached. The list below shows what each
            check came to.
          </p>
        )}
      </div>
    </div>
  );
}

interface FindingDetailProps {
  finding: PatternFinding;
  currency: string | null;
  screenshot: string | null;
  /** The bill card lists the amounts, so a finding beside it leaves them out. */
  showAmounts: boolean;
}

function FindingDetail({ finding, currency, screenshot, showAmounts }: FindingDetailProps) {
  const { quote, amounts, note, step, label, severity } = finding;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:gap-8">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusPill status="found" label={label} />
          <SeverityTag severity={severity} />
        </div>
        {quote ? (
          <blockquote className="max-w-prose border-l-2 border-found py-0.5 pl-3.5 font-serif text-[22px]/[1.3] text-ink italic">
            &ldquo;{quote}&rdquo;
          </blockquote>
        ) : null}
        {showAmounts && amounts.length > 0 ? (
          <ul className="num max-w-sm text-sm">
            {amounts.map((amount) => (
              <li key={amount.label} className="flex justify-between gap-6 py-0.5">
                <span>{amount.label}</span>
                <span>{money(amount.amount, currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {note ? <p className="max-w-prose text-body">{note}</p> : null}
        {step === null ? null : <p className="num text-[13px] text-body">Step {step}</p>}
      </div>
      {screenshot ? (
        <div className="shrink-0">
          <Screenshot
            src={screenshot}
            label={`${label}${step === null ? "" : `, step ${step}`}: what the agent saw`}
          />
          {quote ? (
            <p className="mt-1.5 text-[13px] text-mute">
              The page at this step. The words may be further down.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface FindingsProps {
  report: SiteReport;
  siteId: string;
  scope: ReportScope;
  /** Comes from the report's size: one site's bill heading sits one level higher. */
  Heading: "h2" | "h3";
}

/** The detail of each finding. Drip pricing, or any price rise, also gets the bill beside it. */
export function Findings({ report, siteId, scope, Heading }: FindingsProps) {
  const findings = foundPatterns(report);
  const note = billNote(report);
  const billShown = showsBill(report);
  const dripped = findings.some(({ id }) => id === "drip_pricing");
  const { currency } = report.bill;

  const bill = (
    <div className="overflow-hidden rounded-panel bg-linear-to-b from-[#fff1e6] to-[#fff7f1] px-4 pt-6 sm:px-10 sm:pt-8">
      <Receipt report={report} Heading={Heading} />
    </div>
  );

  if (findings.length === 0 && !billShown) return null;

  return (
    <ol aria-label={`Findings on ${report.host}`} className="flex flex-col gap-4">
      {findings.map((finding) => {
        const shot = finding.screenshot
          ? screenshotUrl(scope, siteId, finding.screenshot.stepId)
          : null;
        const detail = (
          <FindingDetail
            finding={finding}
            currency={currency}
            screenshot={shot}
            showAmounts={!billShown || finding.id !== "drip_pricing"}
          />
        );
        const withBill = billShown && finding.id === "drip_pricing";
        return (
          <li
            key={finding.id}
            id={findingAnchor(siteId, finding.id)}
            className="card scroll-mt-24 p-5 sm:p-6"
          >
            {withBill ? (
              <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
                {bill}
                <div className="flex min-w-0 flex-col gap-3">
                  {detail}
                  {note ? <p className="max-w-prose text-body">{note}</p> : null}
                </div>
              </div>
            ) : (
              detail
            )}
          </li>
        );
      })}
      {billShown && !dripped ? (
        <li className="card p-5 sm:p-6">
          <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
            {bill}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="w-fit">
                <Pill tone="found" text="Price went up" />
              </div>
              {note ? <p className="max-w-prose text-body">{note}</p> : null}
            </div>
          </div>
        </li>
      ) : null}
    </ol>
  );
}
