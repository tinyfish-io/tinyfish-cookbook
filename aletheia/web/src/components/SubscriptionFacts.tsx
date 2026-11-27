import { money, perPeriod } from "../lib/format.ts";
import { SHOWN_WHERE_LABEL, TERM_LABEL } from "../lib/report.ts";
import type { SubscriptionSummary } from "../lib/types.ts";

interface SubscriptionFactsProps {
  subscription: SubscriptionSummary;
  currency: string | null;
  /** What happens to the price after an intro offer, when it goes up. */
  renewal: string | null;
}

export function SubscriptionFacts({ subscription, currency, renewal }: SubscriptionFactsProps) {
  const { plan, billingPeriod, options, terms, contractTotal, renewalTotal, noCommitmentPrice } =
    subscription;

  const totals = [
    ["Contract total", contractTotal],
    ["Renewal total", renewalTotal],
    ["Price with no commitment", noCommitmentPrice],
  ] as const;
  const shownTotals = totals.filter(([, amount]) => amount !== null);
  const planKnown = plan || billingPeriod || renewal || shownTotals.length || options.length;

  return (
    <div
      className={`card grid gap-x-10 gap-y-6 p-5 sm:p-6 ${planKnown && terms.length > 0 ? "lg:grid-cols-2" : ""}`}
    >
      {planKnown ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg">The plan</h3>
            {plan || billingPeriod ? (
              <p className="text-mute">{[plan, billingPeriod].filter(Boolean).join(", ")}</p>
            ) : null}
            {renewal ? <p className="mt-1 text-body">{renewal}</p> : null}
          </div>

          {shownTotals.length > 0 ? (
            <dl className="flex flex-col gap-2">
              {shownTotals.map(([label, amount]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 rounded-xl bg-wash px-3.5 py-2.5"
                >
                  <dt>{label}</dt>
                  <dd className="num font-semibold text-ink">{money(amount ?? 0, currency)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {options.length > 0 ? (
            <div>
              <h4 className="text-sm tracking-normal">Every billing option</h4>
              <ul className="mt-1 divide-y divide-line">
                {options.map((option) => (
                  <li key={option.label} className="py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span>
                        {option.label}
                        {option.selectedByDefault ? (
                          <span className="text-[13px] text-mute"> (picked by default)</span>
                        ) : null}
                      </span>
                      {option.price === null ? null : (
                        <span className="num min-w-0 wrap-anywhere">
                          {money(option.price, currency)}
                          {perPeriod(option.period)}
                        </span>
                      )}
                    </div>
                    {option.commitment ? (
                      <p className="text-[13px] text-mute">{option.commitment}</p>
                    ) : null}
                    {option.feeLine && option.feeLine !== option.commitment ? (
                      <p className="text-[13px] text-mute">{option.feeLine}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {terms.length > 0 ? (
        <div>
          <h3 className="text-lg">Terms, and where the site shows them</h3>
          <ul className="mt-1 divide-y divide-line">
            {terms.map((term) => (
              <li key={term.term} className="py-2.5">
                <p className="flex flex-wrap justify-between gap-x-4">
                  <span className="font-medium text-ink">{TERM_LABEL[term.term]}</span>
                  <span className="text-[13px] text-mute">
                    {SHOWN_WHERE_LABEL[term.shownWhere]}
                    {term.seenAtStep === null ? null : (
                      <span className="num">, step {term.seenAtStep}</span>
                    )}
                  </span>
                </p>
                {term.quote ? <p className="text-[13px] text-mute">{term.quote}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
