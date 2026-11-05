import { useState } from "react";

import { hiddenCostLabel, type CompareColumn, type ComparisonView } from "../lib/compare.ts";
import { counts, stopSummary, tallyLine } from "../lib/report.ts";
import { siteName } from "../lib/sites.ts";
import { foundPatterns } from "../lib/story.ts";
import { Link, Money, SiteAvatar, StatusPill } from "./ui.tsx";

function Price({ amount, currency }: { amount: number | null; currency: string | null }) {
  if (amount === null) return <span className="text-mute">Not reached</span>;
  return <Money amount={amount} currency={currency} />;
}

const headCell =
  "bg-white px-4 py-3 text-left align-top font-normal text-mute sm:sticky sm:left-0 sm:z-1";
const cell = "px-4 py-3 align-top";

interface ComparisonTableProps {
  view: ComparisonView;
  showTasks: boolean;
  headingLevel?: "h2" | "h1";
  /** Where a site's name leads, which differs for a visitor reading a shared report. */
  linkFor: (column: CompareColumn) => string;
  /** Sits above the reports on an audit page, so the pattern rows start folded away. */
  foldPatterns?: boolean;
}

export function ComparisonTable({
  view,
  showTasks,
  headingLevel = "h2",
  linkFor,
  foldPatterns = false,
}: ComparisonTableProps) {
  const { columns, patternRows, pricesMoved, notes } = view;
  const Heading = headingLevel;
  const [patternsShown, setPatternsShown] = useState(!foldPatterns);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Heading id="comparison-title" className="text-[28px]/[1.1] sm:text-[34px]/[1.1]">
          Side by side
        </Heading>
        {notes.length > 0 ? (
          <ul className="mt-1.5 text-mute">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* The table keeps its columns aligned and scrolls inside this box on a phone. */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="comparison-title"
        className="card overflow-x-auto p-2"
      >
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="border-b border-line">
              <td className={headCell} />
              {columns.map((column) => (
                <th key={column.key} scope="col" className={`${cell} min-w-56 text-left`}>
                  <div className="flex items-center gap-3">
                    <SiteAvatar host={column.host} />
                    <div>
                      <Link
                        className="inline-flex min-h-6 items-center text-base font-semibold text-ink hover:underline hover:underline-offset-4"
                        href={linkFor(column)}
                      >
                        {siteName(column.host, column.report.name)}
                      </Link>
                      <p className="num text-[13px] font-normal text-mute">
                        {tallyLine(counts(column.report))}
                      </p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {showTasks ? (
              <tr>
                <th scope="row" className={headCell}>
                  Task
                </th>
                {columns.map((column) => (
                  <td key={column.key} className={`${cell} max-w-56`}>
                    {column.task}
                  </td>
                ))}
              </tr>
            ) : null}
            <tr>
              <th scope="row" className={headCell}>
                Item
              </th>
              {columns.map(({ key, report }) => (
                <td key={key} className={`${cell} max-w-56`}>
                  {report.item ?? <span className="text-mute">Not named</span>}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={headCell}>
                Patterns found
              </th>
              {columns.map(({ key, report }) => {
                const findings = foundPatterns(report);
                return (
                  <td key={key} className={`${cell} max-w-56`}>
                    {findings.length === 0 ? (
                      <span className="text-mute">None seen</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {findings.map(({ id, label }) => (
                          <li key={id} className="font-medium text-peach-ink">
                            {label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
            {pricesMoved ? (
              <>
                <tr>
                  <th scope="row" className={headCell}>
                    First price shown
                  </th>
                  {columns.map(({ key, report: { bill } }) => (
                    <td key={key} className={cell}>
                      <Price amount={bill.firstPrice} currency={bill.currency} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={headCell}>
                    Last total seen
                  </th>
                  {columns.map(({ key, report: { bill } }) => (
                    <td key={key} className={cell}>
                      <Price amount={bill.total} currency={bill.currency} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={headCell}>
                    Price change
                  </th>
                  {columns.map(({ key, hiddenCost, report: { bill } }) => (
                    <td
                      key={key}
                      className={`${cell} num ${(hiddenCost?.amount ?? 0) > 0 ? "font-semibold text-peach-ink" : ""}`}
                    >
                      {hiddenCostLabel(hiddenCost, bill.currency)}
                    </td>
                  ))}
                </tr>
              </>
            ) : null}
            <tr>
              <th scope="row" className={headCell}>
                Where it stopped
              </th>
              {columns.map(({ key, report }) => (
                <td key={key} className={`${cell} max-w-56 text-[13px] text-mute`}>
                  {stopSummary(report)}
                </td>
              ))}
            </tr>
            {patternsShown
              ? patternRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className={headCell}>
                      {row.label}
                    </th>
                    {row.statuses.map((status, index) => (
                      <td key={columns[index]?.key} className={cell}>
                        <StatusPill status={status} />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      {foldPatterns ? (
        <button
          type="button"
          className="btn btn-soft btn-sm w-fit"
          aria-expanded={patternsShown}
          onClick={() => setPatternsShown((shown) => !shown)}
        >
          {patternsShown ? "Hide the pattern list" : "Compare every pattern"}
        </button>
      ) : null}
    </section>
  );
}
