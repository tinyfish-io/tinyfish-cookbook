import type { Program, Application, CompanyProfile, ScheduleMeta, AgentStatus } from "./types";
import { DEFAULT_COMPANY_PROFILE } from "./seed";
import fs from "fs";

const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

type MemoryShape = {
  programs: Program[];
  applications: Application[];
  companyProfile: CompanyProfile;
  meta: Partial<ScheduleMeta>;
  agentStatuses: Record<string, AgentStatus>;
};

function emptyMemory(): MemoryShape {
  return { programs: [], applications: [], companyProfile: DEFAULT_COMPANY_PROFILE, meta: {}, agentStatuses: {} };
}

const useFileStore = !hasKv && !process.env.VERCEL;
const STORE_FILE = "./.founder-mode-local-store.json";

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

const g = globalThis as unknown as { __founderModeMemory?: MemoryShape };
if (!g.__founderModeMemory) {
  g.__founderModeMemory = useFileStore ? loadFromFile() : emptyMemory();
}
const memory = g.__founderModeMemory;

function persist() {
  if (useFileStore) saveToFile(memory);
}

async function kv() {
  const { Redis } = await import("@upstash/redis");
  // .trim() defends against the extremely common copy-paste artifact of a
  // trailing newline or stray space ending up in a pasted secret — this
  // should never be a reason a deployment breaks.
  return new Redis({
    url: (process.env.KV_REST_API_URL ?? "").trim(),
    token: (process.env.KV_REST_API_TOKEN ?? "").trim(),
  });
}

export const store = {
  async getPrograms(): Promise<Program[]> {
    if (!hasKv) return memory.programs;
    const client = await kv();
    return (await client.get<Program[]>("programs")) ?? [];
  },
  async setPrograms(data: Program[]) {
    if (!hasKv) {
      memory.programs = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("programs", data);
  },

  async getApplications(): Promise<Application[]> {
    if (!hasKv) return memory.applications;
    const client = await kv();
    return (await client.get<Application[]>("applications")) ?? [];
  },
  async setApplications(data: Application[]) {
    if (!hasKv) {
      memory.applications = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("applications", data);
  },

  async getCompanyProfile(): Promise<CompanyProfile> {
    if (!hasKv) return memory.companyProfile;
    const client = await kv();
    return (await client.get<CompanyProfile>("companyProfile")) ?? DEFAULT_COMPANY_PROFILE;
  },
  async setCompanyProfile(data: CompanyProfile) {
    if (!hasKv) {
      memory.companyProfile = data;
      persist();
      return;
    }
    const client = await kv();
    await client.set("companyProfile", data);
  },

  async getMeta(): Promise<ScheduleMeta> {
    const fallback: ScheduleMeta = {
      lastDiscoveryAt: null,
      discoveryStartedAt: null,
      discoveryIntervalMs: 24 * 60 * 60 * 1000,
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

  usingKv: hasKv,
};
