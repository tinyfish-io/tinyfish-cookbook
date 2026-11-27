import type { Brand, CountrySites } from "../types.ts";
import { FALLBACK_SITES } from "./fallback.ts";
import { MARKETS } from "./markets.ts";

/** Everyday words that also name a shop or network, so only a brand entry may claim them. */
const COMMON_NAMES: ReadonlySet<string> = new Set([
  "bell",
  "central",
  "courts",
  "catch",
  "free",
  "globe",
  "kmart",
  "next",
  "orange",
  "plus",
  "play",
  "rogers",
  "smart",
  "target",
  "true",
]);
const SHORTEST_NAME = 4;

export function sitesFor(country: string | null): CountrySites | null {
  return (country && MARKETS[country]) || null;
}

export function coveredCountries(): string[] {
  return Object.keys(MARKETS);
}

/** Naming any site on a country's shelves counts, so a data file need not list it twice. */
export function brandsOf(country: string | null): Brand[] {
  const market = sitesFor(country);
  if (!market) return [...FALLBACK_SITES.brands];
  const shelves = Object.values(market.categories).flatMap((sites) =>
    sites
      .filter(({ name }) => name.length >= SHORTEST_NAME && !COMMON_NAMES.has(name.toLowerCase()))
      .map((site) => ({ ...site, aliases: [site.name.toLowerCase()] })),
  );
  // Shelves come last, since an alias goes to the first brand holding it and a shelf knows less.
  return [...market.brands, ...FALLBACK_SITES.brands, ...shelves];
}
