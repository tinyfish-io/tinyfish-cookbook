// Thin storage layer so the rest of the app never cares whether data
// lives in Redis (production) or plain memory (local dev without it set up).
// Vercel's KV product is now backed by Upstash Redis under the hood — adding
// the "Redis" integration from the Vercel Marketplace sets KV_REST_API_URL /
// KV_REST_API_TOKEN automatically, and this switches over with zero code
// changes anywhere else in the app.

import type { SitePriceSeries, BookingRequest, AgentStatus, RouteRecommendation, ScheduleMeta, RouteInfo } from "./types";
import { DEFAULT_ROUTES } from "./seed";
import fs from "fs";

const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type MemoryShape = {
  priceSeries: Record<string, SitePriceSeries>;
  bookingRequests: BookingRequest[];
  agentStatuses: Record<string, AgentStatus>;
  recommendations: RouteRecommendation[];
  meta: Partial<ScheduleMeta>;
  routes: RouteInfo[];
};

function emptyMemory(): MemoryShape {
  return { priceSeries: {}, bookingRequests: [], agentStatuses: {}, recommendations: [], meta: {}, routes: [] };
}

// Local dev (no Redis configured) persists to a small JSON file on disk
// instead of pure in-memory. Without this, every dev-server restart wiped
// all state — meaning "has a sweep ever run?" kept coming back false, and
// the one-time local bootstrap sweep would re-fire on every restart instead
// of truly only once. Never used on Vercel — production always has Redis.
const useFileStore = !hasKv && !process.env.VERCEL;
const STORE_FILE = "./.fareguard-local-store.json";

function loadFromFile(): MemoryShape {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      return { ...emptyMemory(), ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error("[store] failed to read local store file, starting fresh:", err);
  }
  return emptyMemory();
}

function saveToFile(data: MemoryShape) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data), "utf-8");
  } catch (err) {
    console.error("[store] failed to write local store file:", err);
  }
}

// `globalThis` keeps this alive across hot-reloads within the same process;
// the file keeps it alive across actual process restarts.
const g = globalThis as unknown as { __fareguardMemory?: MemoryShape };
if (!g.__fareguardMemory) {
  g.__fareguardMemory = useFileStore ? loadFromFile() : emptyMemory();
}
const memory = g.__fareguardMemory;

function persist() {
  if (useFileStore) saveToFile(memory);
}

async function kv() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

export const store = {
  async getPriceSeries(): Promise<Record<string, SitePriceSeries>> {
    if (!hasKv) return memory.priceSeries;
    const client = await kv();
    const data = await client.get<Record<string, SitePriceSeries>>("priceSeries");
    return data ?? {};
  },

  async setPriceSeries(data: Record<string, SitePriceSeries>) {
    if (!hasKv) {
      memory.priceSeries = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("priceSeries", data);
  },

  async getBookingRequests(): Promise<BookingRequest[]> {
    if (!hasKv) return memory.bookingRequests;
    const client = await kv();
    const data = await client.get<BookingRequest[]>("bookingRequests");
    return data ?? [];
  },

  async setBookingRequests(data: BookingRequest[]) {
    if (!hasKv) {
      memory.bookingRequests = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("bookingRequests", data);
  },

  async getAgentStatuses(): Promise<Record<string, AgentStatus>> {
    if (!hasKv) return memory.agentStatuses;
    const client = await kv();
    const data = await client.get<Record<string, AgentStatus>>("agentStatuses");
    return data ?? {};
  },

  async setAgentStatuses(data: Record<string, AgentStatus>) {
    if (!hasKv) {
      memory.agentStatuses = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("agentStatuses", data);
  },

  async getRecommendations(): Promise<RouteRecommendation[]> {
    if (!hasKv) return memory.recommendations;
    const client = await kv();
    const data = await client.get<RouteRecommendation[]>("recommendations");
    return data ?? [];
  },

  async setRecommendations(data: RouteRecommendation[]) {
    if (!hasKv) {
      memory.recommendations = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("recommendations", data);
  },

  async getMeta(): Promise<ScheduleMeta> {
    const fallback: ScheduleMeta = {
      lastSweepAt: null,
      sweepStartedAt: null,
      lastAnalyzeAt: null,
      lastDispatchedAt: null,
      sweepIntervalMs: 8 * 60 * 60 * 1000,
      analyzeIntervalMs: 8 * 60 * 60 * 1000,
      usingRealAgents: Boolean(process.env.TINYFISH_API_KEY),
    };
    if (!hasKv) return { ...fallback, ...memory.meta };
    const client = await kv();
    const data = await client.get<ScheduleMeta>("meta");
    return { ...fallback, ...(data ?? {}) };
  },

  async setMeta(patch: Partial<ScheduleMeta>) {
    const current = await this.getMeta();
    const next = { ...current, ...patch };
    if (!hasKv) {
      memory.meta = next;
      persist();
      return next;
    }
    const client = await kv();
    await client.set("meta", next);
    return next;
  },

  async getRoutes(): Promise<RouteInfo[]> {
    if (!hasKv) {
      if (memory.routes.length === 0) {
        memory.routes = DEFAULT_ROUTES;
        persist();
      }
      return memory.routes;
    }
    const client = await kv();
    const data = await client.get<RouteInfo[]>("routes");
    if (!data || data.length === 0) {
      await client.set("routes", DEFAULT_ROUTES);
      return DEFAULT_ROUTES;
    }
    return data;
  },

  async setRoutes(data: RouteInfo[]) {
    if (!hasKv) {
      memory.routes = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("routes", data);
  },

  usingKv: hasKv,
};
