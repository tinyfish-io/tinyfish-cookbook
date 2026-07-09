import { Bank, RateListing } from "./types";
import { RateProduct } from "./products";
import { seedRandom } from "./formatters";
import { getTinyFishClient, pollRun } from "./tinyfish";
import { BANK_RATE_PAGE } from "./bankUrls";

const BASE_RATE_BY_KIND: Record<string, number> = {
  "savings-12m": 5.4,
  "home-loan": 8.2,
  "personal-loan": 11.5
};

// Used ONLY when no TINYFISH_API_KEY is configured at all — a distinct
// "no key set up yet" dev-convenience mode, not a per-agent failure
// fallback. Clearly a different code path from emptyListing() below.
function simulateCompetitorRate(bank: Bank, product: RateProduct): RateListing {
  const rand = seedRandom(bank.id + product.id + new Date().toDateString());
  const base = BASE_RATE_BY_KIND[product.id] ?? 8;
  const jitter = (rand() - 0.45) * 1.4;
  const ratePercent = Math.round((base + jitter) * 100) / 100;
  return {
    bankId: bank.id,
    bankName: bank.name,
    domain: bank.domain,
    isSponsor: false,
    productId: product.id,
    status: "done",
    ratePercent: Math.max(0.1, ratePercent),
    minAmountVND: product.kind === "savings" ? 1_000_000 : 100_000_000,
    source: "scraped",
    live: false,
    checkedAt: new Date().toISOString()
  };
}

// Once a real agent is configured, a genuine miss (product not found, or
// the whole run failed) is shown as empty — never quietly swapped for a
// fabricated number that looks identical to a real one. Honest failure
// beats a full-looking dashboard that's lying about half its data.
function emptyListing(bank: Bank, product: RateProduct): RateListing {
  return {
    bankId: bank.id,
    bankName: bank.name,
    domain: bank.domain,
    isSponsor: false,
    productId: product.id,
    status: "error",
    ratePercent: undefined,
    minAmountVND: undefined,
    source: "scraped",
    live: false,
    checkedAt: new Date().toISOString()
  };
}

// One real-time TinyFish agent per competitor bank, one pass, all 3 rate
// products read together — uses the real @tiny-fish/sdk queue()+poll
// pattern (per TinyFish's guidance for multi-step site reads). Each
// listing carries its OWN live flag and, once a key is configured, a
// genuine miss shows as empty rather than a disguised simulated value.
export async function fetchBankRates(
  bank: Bank,
  products: RateProduct[]
): Promise<{ listings: RateListing[]; live: boolean }> {
  const client = getTinyFishClient();
  if (!client) {
    console.log(`[TinyFish] ${bank.id}: no TINYFISH_API_KEY configured — using simulated rates`);
    return { listings: products.map((p) => simulateCompetitorRate(bank, p)), live: false };
  }

  try {
    const productList = products.map((p) => `- "${p.name}" (id: ${p.id})`).join("\n");
    const goal = `Visit ${bank.domain} and find the current published rate for each of these products:
${productList}

Navigate to find the right page yourself: look in the main menu, footer, or site search for links like "Interest Rates", "Rates", "Savings", "Deposit", "Loans", or the Vietnamese equivalents ("Lãi suất", "Tiết kiệm", "Vay"). Bank sites often keep a dedicated rates page separate from product pages — check both.

Work as quickly and efficiently as possible. Take the minimum number of steps needed. For each product: try to find it once. If you succeed, record it and move to the next product immediately — do not re-check or re-verify a product you've already found. If that first attempt fails, try one more time (2 attempts total for that product), then give up on it and move on rather than continuing to search.

For savings products, find the APY / interest rate for that term. For loan products, find the advertised annual interest rate. If a product genuinely cannot be found after 2 attempts, skip it rather than guessing — return no data for it.

Return ONLY a JSON array, no other text, in this exact shape:
[{"product_id": "savings-12m", "rate_percent": 5.6}]`;

    console.log(`[TinyFish] ${bank.id}: queuing real agent at ${BANK_RATE_PAGE[bank.id] ?? bank.domain}`);
    const queued = await client.agent.queue({
      url: BANK_RATE_PAGE[bank.id] ?? `https://${bank.domain}`,
      goal,
      browser_profile: "stealth"
    });
    if (!queued.run_id) throw new Error(queued.error?.message ?? "queue failed with no run_id");

    const run = await pollRun(client, queued.run_id);
    const raw = run.result?.result ?? run.result;
    const rows: Array<{ product_id: string; rate_percent: number }> = typeof raw === "string" ? JSON.parse(raw) : (raw as never);
    console.log(`[TinyFish] ${bank.id}: agent returned ${rows.length}/${products.length} products`);

    const byId = new Map(rows.map((r) => [r.product_id, r]));
    const checkedAt = new Date().toISOString();
    const listings = products.map((p) => {
      const row = byId.get(p.id);
      if (!row) {
        console.log(`[TinyFish] ${bank.id}: no rate found for ${p.id} — showing empty, not simulated`);
        return emptyListing(bank, p);
      }
      return {
        bankId: bank.id,
        bankName: bank.name,
        domain: bank.domain,
        isSponsor: false,
        productId: p.id,
        status: "done" as const,
        ratePercent: Number(row.rate_percent),
        minAmountVND: p.kind === "savings" ? 1_000_000 : 100_000_000,
        source: "scraped" as const,
        live: true,
        checkedAt
      };
    });
    const anyLive = listings.some((l) => l.live);
    return { listings, live: anyLive };
  } catch (err) {
    console.error(`[TinyFish] ${bank.id}: agent failed — showing empty for this bank, not simulated —`, err);
    return { listings: products.map((p) => emptyListing(bank, p)), live: false };
  }
}
