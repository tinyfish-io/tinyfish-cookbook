import { moneyParts } from "../lib/format.ts";
import { billLines, billMismatch, paidLabel } from "../lib/report.ts";
import { billPill, totalLine } from "../lib/story.ts";
import type { SiteReport } from "../lib/types.ts";
import { Money, Pill } from "./ui.tsx";

function exact(amount: number, currency: string | null): string {
  const { main, minor } = moneyParts(amount, currency);
  return `${main}${minor}`;
}

/** The bill card that sits in the pastel panel. The card runs off the panel's bottom edge. */
export function Receipt({ report, Heading }: { report: SiteReport; Heading: "h2" | "h3" }) {
  const { bill, priceLabel, item } = report;
  const lines = billLines(bill);
  const said = totalLine(report);
  const mismatch = billMismatch(bill);

  if (lines.length === 0) {
    return (
      <div className="card flex-1 rounded-b-none px-6 py-8 text-center">
        <Heading className="text-lg">The bill</Heading>
        <p className="mt-1 text-mute">The agent never reached a price on this site.</p>
      </div>
    );
  }

  return (
    <div className="card flex-1 rounded-b-none border-b-0 px-4 pt-6 pb-5 sm:px-[26px] sm:pt-[26px] sm:pb-[22px]">
      <div className="text-center">
        <Heading className="sr-only">The bill</Heading>
        <div className="mb-2 flex justify-center">
          <Pill {...billPill(report)} className="whitespace-normal" />
        </div>
        {bill.total === null ? (
          <p className="text-mute">The run ended before a total appeared.</p>
        ) : (
          <>
            <p className="text-[40px]/none font-semibold tracking-[-0.03em] text-ink sm:text-5xl/none">
              <Money amount={bill.total} currency={bill.currency} />
            </p>
            <p className="mt-1.5 text-[13px] text-mute">
              {said.lead}
              {said.said ? (
                <>
                  {` ${said.said} `}
                  <b className="num font-semibold text-ink">{said.shown}</b>.
                </>
              ) : null}
            </p>
          </>
        )}
      </div>

      <ul className="mt-3">
        {lines.map((line) => (
          <li
            key={line.label}
            className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-wash px-3.5 py-[11px]"
          >
            <span className="min-w-0">
              {line.sign === "base" && item ? item : line.label}
              {line.tag ? (
                <span className="ml-2 inline-block rounded-full bg-peach px-2 py-0.5 text-[11px] font-semibold text-peach-ink">
                  {line.tag}
                </span>
              ) : null}
              {line.late ? (
                <span className="ml-2 inline-block rounded-full bg-peach px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-peach-ink">
                  step {line.step}
                </span>
              ) : null}
            </span>
            <span className="num shrink-0">
              {line.sign === "minus" ? "- " : null}
              {exact(line.amount, bill.currency)}
            </span>
          </li>
        ))}
      </ul>

      {bill.total === null ? null : (
        <div className="num mt-3 flex items-center justify-between gap-4 border-t border-line px-1 pt-3.5 font-semibold text-ink">
          <span>{paidLabel(priceLabel)}</span>
          <span>{exact(bill.total, bill.currency)}</span>
        </div>
      )}

      {bill.addsUp === false && mismatch !== null ? (
        <p className="num mt-2 px-1 text-[13px] text-peach-ink">{mismatch}.</p>
      ) : null}

      {bill.includedCharges.length > 0 ? (
        <div className="mt-3 px-1 text-[13px] text-mute">
          <p>Already inside the first price:</p>
          <ul>
            {bill.includedCharges.map((charge) => (
              <li key={charge.name} className="flex justify-between gap-4">
                <span>{charge.name}</span>
                <span className="num">{exact(charge.amount, bill.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
