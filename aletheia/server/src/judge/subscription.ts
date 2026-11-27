import type { Evidence } from "./evidence.ts";
import { isNoCommitment } from "./patterns.ts";
import type { SubscriptionSummary } from "./types.ts";

function billedMonthlyOnAnnualTerm(period: string): boolean {
  return /annual|12[ -]month|yearly commitment/i.test(period) && /month/i.test(period);
}

function paidYearly(period: string): boolean {
  return /year|annual/i.test(period) && !/month/i.test(period);
}

function yearly(period: string | null, price: number | null): number | null {
  if (!period || price === null) return null;
  if (billedMonthlyOnAnnualTerm(period)) return price * 12;
  return paidYearly(period) ? price : null;
}

export function summariseSubscription(evidence: Evidence): SubscriptionSummary {
  const period = evidence.billingPeriod;
  const firstPrice = evidence.introPrice ?? evidence.listedPrice;
  const contractTotal = yearly(period, firstPrice);
  const renewalTotal = yearly(period, evidence.priceAfterIntro);
  const noCommitment = evidence.planOptions.find((option) => isNoCommitment(option.commitment));

  return {
    plan: evidence.planName,
    billingPeriod: period,
    defaultSelected: evidence.defaultSelected,
    options: evidence.planOptions,
    terms: evidence.terms,
    introPrice: evidence.introPrice,
    introPeriod: evidence.introPeriod,
    priceAfterIntro: evidence.priceAfterIntro,
    contractTotal,
    renewalTotal,
    renewalMultiple:
      contractTotal !== null && renewalTotal !== null && contractTotal > 0
        ? renewalTotal / contractTotal
        : null,
    noCommitmentPrice: noCommitment?.price ?? null,
  };
}
