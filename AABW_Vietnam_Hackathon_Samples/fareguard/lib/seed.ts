import type { RouteInfo, SiteInfo, SitePriceSeries, AgentStatus, PricePoint, RouteCode } from "./types";

// The starting set of routes — after this, routes are stored and can grow
// via the "Add route" flow (see /api/routes). This is only the seed for a
// brand new install, not a fixed list.
export const DEFAULT_ROUTES: RouteInfo[] = [
  { code: "HAN-SGN", from: "HAN", fromCity: "Hanoi", to: "SGN", toCity: "Ho Chi Minh City", label: "Hanoi to Ho Chi Minh City" },
  { code: "SGN-DAD", from: "SGN", fromCity: "Ho Chi Minh City", to: "DAD", toCity: "Da Nang", label: "Ho Chi Minh City to Da Nang" },
];

export const SITES: SiteInfo[] = [
  { id: "vietjet", name: "Vietjet Air", type: "Airline", supportsAutoFill: true, url: "https://www.vietjetair.com/en" },
  { id: "vietnam-airlines", name: "Vietnam Airlines", type: "Airline", supportsAutoFill: false, url: "https://www.vietnamairlines.com/vn/en/home" },
  { id: "bamboo", name: "Bamboo Airways", type: "Airline", supportsAutoFill: false, url: "https://www.bambooairways.com/" },
  { id: "traveloka", name: "Traveloka", type: "OTA", supportsAutoFill: false, url: "https://www.traveloka.com/en-en/flight" },
  { id: "baolau", name: "Baolau", type: "OTA", supportsAutoFill: false, url: "https://www.baolau.com/en" },
  { id: "12bay", name: "12Bay", type: "OTA", supportsAutoFill: false, url: "https://12bay.vn/" },
  { id: "skyscanner-vn", name: "Skyscanner VN", type: "OTA", supportsAutoFill: false, url: "https://www.skyscanner.com.vn/", useFetch: true },
];

// Base one-way economy fares in VND for the two default routes, anchored to
// real published fare ranges. Routes added later (via "Add route") fall
// back to GENERIC_BASE_FARE since we don't have a researched anchor for
// arbitrary user-added routes.
const BASE_FARES: Record<string, Record<string, number>> = {
  "HAN-SGN": {
    vietjet: 1250000,
    "vietnam-airlines": 2650000,
    bamboo: 1580000,
    traveloka: 1230000,
    baolau: 1310000,
    "12bay": 1290000,
    "skyscanner-vn": 1240000,
  },
  "SGN-DAD": {
    vietjet: 1080000,
    "vietnam-airlines": 1820000,
    bamboo: 1260000,
    traveloka: 1050000,
    baolau: 1120000,
    "12bay": 1090000,
    "skyscanner-vn": 1070000,
  },
};

const GENERIC_BASE_FARE: Record<string, number> = {
  vietjet: 1150000,
  "vietnam-airlines": 2200000,
  bamboo: 1350000,
  traveloka: 1130000,
  baolau: 1200000,
  "12bay": 1170000,
  "skyscanner-vn": 1140000,
};

// Deterministic PRNG so seed data is stable across reloads/restarts.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function generateHistory(siteId: string, routeCode: RouteCode, basePrice: number): PricePoint[] {
  const rand = mulberry32(hashString(`${siteId}-${routeCode}`));
  const points: PricePoint[] = [];
  const days = 14;
  const now = Date.now();
  // mild drift direction per series, so some routes trend up and some down
  const drift = (rand() - 0.5) * 0.012; // up to ~1.2% per day drift
  let price = basePrice * (1 + (rand() - 0.5) * 0.08);
  for (let i = days - 1; i >= 0; i--) {
    const noise = (rand() - 0.5) * 0.025; // +-2.5% daily noise
    price = price * (1 + drift + noise);
    price = Math.max(price, basePrice * 0.7);
    const timestamp = new Date(now - i * 24 * 60 * 60 * 1000).toISOString();
    points.push({ timestamp, priceVnd: Math.round(price / 1000) * 1000, source: "seed" });
  }
  return points;
}

export function generateSeedData(routes: RouteInfo[]): {
  priceSeries: Record<string, SitePriceSeries>;
  agentStatuses: Record<string, AgentStatus>;
} {
  const priceSeries: Record<string, SitePriceSeries> = {};
  const agentStatuses: Record<string, AgentStatus> = {};

  SITES.forEach((site, siteIndex) => {
    routes.forEach((route) => {
      const key = `${site.id}__${route.code}`;
      const base = BASE_FARES[route.code]?.[site.id] ?? GENERIC_BASE_FARE[site.id] ?? 1200000;
      priceSeries[key] = {
        siteId: site.id,
        routeCode: route.code,
        history: generateHistory(site.id, route.code, base),
      };
    });
    agentStatuses[site.id] = {
      siteId: site.id,
      status: "done",
      lastSyncedAt: new Date(Date.now() - siteIndex * 6 * 60 * 1000).toISOString(),
      routesCovered: routes.map((r) => r.code),
    };
  });

  return { priceSeries, agentStatuses };
}
