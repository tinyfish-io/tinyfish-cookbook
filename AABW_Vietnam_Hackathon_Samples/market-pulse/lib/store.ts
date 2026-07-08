import type { CompetitorListing, AgentStatus, RestockRequest, ScheduleMeta } from "./types";
import fs from "fs";

const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type MemoryShape = {
  listings: Record<string, CompetitorListing>;
  agentStatuses: Record<string, AgentStatus>;
  restockRequests: RestockRequest[];
  meta: Partial<ScheduleMeta>;
};

function emptyMemory(): MemoryShape {
  return { listings: {}, agentStatuses: {}, restockRequests: [], meta: {} };
}

const useFileStore = !hasKv && !process.env.VERCEL;
const STORE_FILE = "./.marketpulse-local-store.json";

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

const g = globalThis as unknown as { __marketPulseMemory?: MemoryShape };
if (!g.__marketPulseMemory) {
  g.__marketPulseMemory = useFileStore ? loadFromFile() : emptyMemory();
}
const memory = g.__marketPulseMemory;

function persist() {
  if (useFileStore) saveToFile(memory);
}

async function kv() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: (process.env.KV_REST_API_URL ?? "").trim(),
    token: (process.env.KV_REST_API_TOKEN ?? "").trim(),
  });
}

export const store = {
  async getListings(): Promise<Record<string, CompetitorListing>> {
    if (!hasKv) return memory.listings;
    const client = await kv();
    return (await client.get<Record<string, CompetitorListing>>("listings")) ?? {};
  },
  async setListings(data: Record<string, CompetitorListing>) {
    if (!hasKv) {
      memory.listings = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("listings", data);
  },

  async getAgentStatuses(): Promise<Record<string, AgentStatus>> {
    if (!hasKv) return memory.agentStatuses;
    const client = await kv();
    return (await client.get<Record<string, AgentStatus>>("agentStatuses")) ?? {};
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

  async getRestockRequests(): Promise<RestockRequest[]> {
    if (!hasKv) return memory.restockRequests;
    const client = await kv();
    return (await client.get<RestockRequest[]>("restockRequests")) ?? [];
  },
  async setRestockRequests(data: RestockRequest[]) {
    if (!hasKv) {
      memory.restockRequests = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("restockRequests", data);
  },

  async getMeta(): Promise<ScheduleMeta> {
    const fallback: ScheduleMeta = {
      lastSweepAt: null,
      sweepStartedAt: null,
      sweepIntervalMs: 24 * 60 * 60 * 1000,
      usingRealAgents: Boolean(process.env.TINYFISH_API_KEY),
      lastDispatchedAt: null,
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

  usingKv: hasKv,
};
