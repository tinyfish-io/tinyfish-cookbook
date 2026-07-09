import { RateListing } from "./types";
import { PRODUCTS } from "./products";
import { OUR_BANK } from "./banks";
import { seedRandom } from "./formatters";

// Shinhan already knows its own published rates — pulled from an internal
// feed, never scraped from its own site. In a real deployment this calls
// Shinhan's internal rate-sheet system directly.
const BASE_RATE: Record<string, number> = {
  "savings-12m": 5.4, // APY %
  "home-loan": 8.2,   // interest rate %
  "personal-loan": 11.5
};

export function getInternalRates(): RateListing[] {
  const checkedAt = new Date().toISOString();
  return PRODUCTS.map((p) => {
    const rand = seedRandom("shinhan-" + p.id + new Date().toDateString());
    const jitter = (rand() - 0.5) * 0.6; // +/- 0.3%
    const ratePercent = Math.round((BASE_RATE[p.id] + jitter) * 100) / 100;
    return {
      bankId: OUR_BANK.id,
      bankName: OUR_BANK.name,
      domain: OUR_BANK.domain,
      isSponsor: true,
      productId: p.id,
      status: "done" as const,
      ratePercent,
      minAmountVND: p.kind === "savings" ? 1_000_000 : 100_000_000,
      source: "internal" as const,
      live: true, // internal feed is always "real" data, just never scraped
      checkedAt
    };
  });
}
