import { storeGet, storeSet, acquireLock, releaseLock } from "./storage";
import { PORTALS, EXAMPLE_SEARCH } from "./seed";
import { runListingsSweep, toListings } from "./listings";
import { hoursSince } from "./date";
import type { TrackedSearch, Listing, AgentStatus, PropertyType, ListingIntent } from "./types";

const SEARCHES_KEY = "tracked-searches";
const LISTINGS_KEY = "listings";
const STATUS_KEY = "agent-statuses";
const LOCK_KEY = "sweep-lock";
const LOCK_TTL_SECONDS = 8 * 60;
const DUE_AFTER_HOURS = 48;

export async function getSearches(): Promise<TrackedSearch[]> {
  const data = await storeGet<TrackedSearch[]>(SEARCHES_KEY);
  if (data) return data;
  await storeSet(SEARCHES_KEY, [EXAMPLE_SEARCH]);
  return [EXAMPLE_SEARCH];
}

export async function getSearch(id: string): Promise<TrackedSearch | null> {
  const all = await getSearches();
  return all.find((s) => s.id === id) ?? null;
}

export async function addSearch(input: {
  area: string;
  propertyType: PropertyType;
  intent: ListingIntent;
  clientName: string | null;
}): Promise<TrackedSearch> {
  const all = await getSearches();
  const search: TrackedSearch = {
    id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    area: input.area,
    propertyType: input.propertyType,
    intent: input.intent,
    clientName: input.clientName || null,
    createdAt: new Date().toISOString(),
    lastSweptAt: null,
  };
  await storeSet(SEARCHES_KEY, [search, ...all]);
  return search;
}

export async function getAllListings(): Promise<Record<string, Listing[]>> {
  return (await storeGet<Record<string, Listing[]>>(LISTINGS_KEY)) ?? {};
}

export async function getListingsForSearch(searchId: string): Promise<Listing[]> {
  const all = await getAllListings();
  return Object.entries(all)
    .filter(([key]) => key.startsWith(`${searchId}__`))
    .flatMap(([, listings]) => listings);
}

export async function getAgentStatuses(): Promise<Record<string, AgentStatus>> {
  return (await storeGet<Record<string, AgentStatus>>(STATUS_KEY)) ?? {};
}

function dueSearches(all: TrackedSearch[]): TrackedSearch[] {
  return all.filter((s) => s.lastSweptAt === null || hoursSince(s.lastSweptAt) >= DUE_AFTER_HOURS);
}

// The single sweep implementation — used by the daily GitHub Actions cron
// (which only actually processes searches that are genuinely due, so a
// simple daily schedule still yields a real 48h-per-search cadence) AND by
// the "sweep this one now" bootstrap that fires the instant a new search
// is added, scoped to just that one search via forceSearchIds.
export async function runSweep(reason: string, forceSearchIds?: string[]): Promise<{ portalsSwept: number; searchesSwept: number }> {
  if (!(await acquireLock(LOCK_KEY, LOCK_TTL_SECONDS))) {
    console.log(`[sweep] a sweep is already in progress — skipping duplicate trigger (reason: ${reason})`);
    return { portalsSwept: 0, searchesSwept: 0 };
  }
  try {
    console.log(`[sweep] starting — reason: ${reason}`);
    const all = await getSearches();
    const targets = forceSearchIds ? all.filter((s) => forceSearchIds.includes(s.id)) : dueSearches(all);

    if (targets.length === 0) {
      console.log("[sweep] nothing due right now");
      return { portalsSwept: 0, searchesSwept: 0 };
    }

    await runListingsSweep(PORTALS, targets, async (portal, result, status) => {
      if (result) {
        const currentListings = await getAllListings();
        for (const r of result.results) {
          const key = `${r.searchId}__${portal.id}`;
          currentListings[key] = toListings(r.searchId, portal.id, r.listings);
        }
        await storeSet(LISTINGS_KEY, currentListings);
      }
      const currentStatuses = await getAgentStatuses();
      currentStatuses[portal.id] = status;
      await storeSet(STATUS_KEY, currentStatuses);
      console.log(`[sweep] ${portal.name} done — ${status.listingsFound} listings found across ${targets.length} search(es)`);
    });

    const updatedAll = (await getSearches()).map((s) =>
      targets.some((t) => t.id === s.id) ? { ...s, lastSweptAt: new Date().toISOString() } : s
    );
    await storeSet(SEARCHES_KEY, updatedAll);

    console.log(`[sweep] complete — ${PORTALS.length} portals × ${targets.length} search(es)`);
    return { portalsSwept: PORTALS.length, searchesSwept: targets.length };
  } finally {
    await releaseLock(LOCK_KEY);
  }
}

let bootstrapChecked = false;
export function bootstrapLocalDevIfNeeded() {
  if (process.env.VERCEL) return;
  if (!process.env.TINYFISH_API_KEY) return;
  if (bootstrapChecked) return;
  bootstrapChecked = true;

  getSearches().then((all) => {
    const neverSwept = all.filter((s) => s.lastSweptAt === null);
    if (neverSwept.length === 0) return;
    console.log("[bootstrap] first run detected, sweeping never-checked searches in the background...");
    runSweep("local-dev-bootstrap (first ever run)", neverSwept.map((s) => s.id))
      .then(() => console.log("[bootstrap] background sweep complete"))
      .catch((err) => console.error("[bootstrap] background sweep failed:", err));
  });
}
