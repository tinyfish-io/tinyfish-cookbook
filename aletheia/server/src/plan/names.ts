import { FALLBACK_SITES, REGIONAL_MARKETPLACES } from "./sites/fallback.ts";
import { MARKETS } from "./sites/markets.ts";
import type { Brand, Site } from "./types.ts";

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "").toLowerCase();

function everySite(): Site[] {
  const shelves = (categories: Record<string, readonly Site[] | undefined>) =>
    Object.values(categories).flatMap((sites) => sites ?? []);
  const brandUrls = (brand: Brand): Site[] => [
    brand,
    ...Object.values(brand.urls ?? {}).flatMap((url) => (url ? [{ name: brand.name, url }] : [])),
  ];
  // Brands go first: they name a site the way the site names itself.
  return [
    ...Object.values(MARKETS).flatMap((market) => market.brands.flatMap(brandUrls)),
    ...FALLBACK_SITES.brands.flatMap(brandUrls),
    ...Object.values(MARKETS).flatMap((market) => shelves(market.categories)),
    ...shelves(FALLBACK_SITES.categories),
    ...Object.values(REGIONAL_MARKETPLACES).flatMap((site) => (site ? [site] : [])),
  ];
}

let byHost: Map<string, string> | undefined;

function names(): Map<string, string> {
  if (byHost) return byHost;
  byHost = new Map();
  for (const { name, url } of everySite()) {
    const host = hostOf(url);
    if (!byHost.has(host)) byHost.set(host, name);
  }
  return byHost;
}

/** The site's own name for a host, such as "Best Buy" for bestbuy.ca, or null if it is not known. */
export function brandName(host: string): string | null {
  const known = names();
  const bare = host.replace(/^www\./, "").toLowerCase();
  const exact = known.get(bare);
  if (exact) return exact;
  // A country subdomain, such as in.bookmyshow.com beside uk.bookmyshow.com, is the same site.
  const parentOf = (name: string) => name.replace(/^[a-z]{2}\.(?=[^.]+\.)/, "");
  const parent = parentOf(bare);
  for (const [knownHost, name] of known) {
    if (parentOf(knownHost) === parent) return name;
  }
  return null;
}
