import type { ReactNode } from "react";

import { patternGroups } from "../lib/report.ts";
import type { PatternFinding, SiteReport } from "../lib/types.ts";
import { findingAnchor } from "./Findings.tsx";
import { Chevron } from "./icons.tsx";
import { StatusPill } from "./ui.tsx";

const ROW_TINT: Record<PatternFinding["status"], string> = {
  found: "bg-peach",
  not_found: "bg-wash",
  not_checked: "bg-wash",
  not_applicable: "bg-wash",
};

interface PatternListProps {
  report: SiteReport;
  siteId: string;
  /** True when this report arrived while the page was open, so the found pills pop. */
  press: boolean;
}

const ROW = "min-h-12 items-center justify-between gap-3 rounded-[14px] py-2 pr-2.5 pl-3.5";

const GRID = "grid gap-2 p-1.5 md:grid-cols-2 lg:grid-cols-3";

export function PatternList({ report, siteId, press }: PatternListProps) {
  const { checked: rows, notApplicable, heading } = patternGroups(report);
  const partial = rows.some((row) => row.status === "not_found" && row.soFar);

  return (
    <>
      {partial ? (
        <p className="px-4 pb-2 text-[13px] text-mute">
          Not found holds only up to the last page the agent reached.
        </p>
      ) : null}
      <ul className={GRID}>
        {rows.map((row, index) => {
          const pill = <StatusPill status={row.status} {...(press ? { popOrder: index } : {})} />;
          return (
            <li key={row.id}>
              {row.status === "found" ? (
                <a
                  href={`#${findingAnchor(siteId, row.id)}`}
                  className={`flex font-medium text-text transition-colors hover:text-ink ${ROW} ${ROW_TINT.found}`}
                >
                  <span className="min-w-0">{row.label}</span>
                  {pill}
                </a>
              ) : (
                <NoteRow row={row} pill={pill} />
              )}
            </li>
          );
        })}
      </ul>
      {notApplicable.length > 0 ? (
        <section aria-label={heading} className="mt-3 border-t border-line pt-3">
          <h4 className="px-3.5 pb-1 text-[13px] font-medium text-mute">{heading}</h4>
          <ul className={GRID}>
            {notApplicable.map((row) => (
              <li key={row.id}>
                <NoteRow row={row} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function NoteRow({ row, pill }: { row: PatternFinding; pill?: ReactNode }) {
  return (
    <details className={`group rounded-[14px] ${ROW_TINT[row.status]}`}>
      <summary className={`flex font-medium text-text transition-colors hover:text-ink ${ROW}`}>
        <span className="min-w-0">{row.label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {pill ?? <StatusPill status={row.status} />}
          <span aria-hidden="true" className="text-mute transition-transform group-open:rotate-90">
            <Chevron size={14} />
          </span>
        </span>
      </summary>
      {row.note ? <p className="px-3.5 pb-3 text-[13px] text-mute">{row.note}</p> : null}
    </details>
  );
}
