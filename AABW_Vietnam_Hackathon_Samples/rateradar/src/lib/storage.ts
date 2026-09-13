import fs from "fs";
import path from "path";

// Production: Upstash Redis (works over plain fetch, no TCP connection
// needed, so it's serverless-safe). Local dev without Redis configured:
// a JSON file next to the project so state survives dev-server restarts.
// Last resort (no Redis, no filesystem access): in-memory only.

let redisClient: { get: (k: string) => Promise<string | null>; set: (k: string, v: string) => Promise<unknown> } | null = null;

async function getRedis() {
  // Copy-pasting secrets into GitHub/Vercel env var fields easily picks up
  // a trailing newline or leading space — Upstash's client rejects that
  // outright ("URL contains whitespace or newline"). Trim defensively so
  // a stray newline in a pasted secret doesn't take the whole app down.
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    // Inside a GitHub Actions runner specifically, silently falling back
    // to a local file is actively dangerous: the runner's filesystem is
    // thrown away the instant the job ends, so the sweep would appear to
    // complete successfully (correct data in the logs) while nothing was
    // ever actually saved anywhere the deployed app can see. Fail loudly
    // instead of failing silently.
    if (process.env.GITHUB_ACTIONS === "true") {
      throw new Error(
        "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN aren't set in this GitHub Actions run. " +
          "Add them as repository secrets (Settings → Secrets and variables → Actions) with the exact " +
          "same values as your Vercel project — without them, this sweep would silently write to a " +
          "throwaway file on the runner instead of the real database, and Vercel would never see it."
      );
    }
    return null;
  }
  if (redisClient) return redisClient;
  const { Redis } = await import("@upstash/redis");
  redisClient = new Redis({ url, token }) as unknown as typeof redisClient extends null ? never : NonNullable<typeof redisClient>;
  return redisClient;
}

const LOCAL_STATE_PATH = path.join(process.cwd(), ".local-state.json");
const memoryStore: Record<string, string> = {};

function readLocalFile(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_STATE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeLocalFile(data: Record<string, string>) {
  try {
    fs.writeFileSync(LOCAL_STATE_PATH, JSON.stringify(data, null, 2));
  } catch {
    // read-only filesystem (e.g. some serverless envs) — fall through, the
    // in-memory store still works for the lifetime of this instance.
  }
}

export async function storeGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(key);
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : (raw as T)) : null;
  }
  if (!process.env.VERCEL) {
    const data = readLocalFile();
    return data[key] ? JSON.parse(data[key]) : null;
  }
  return memoryStore[key] ? JSON.parse(memoryStore[key]) : null;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  const redis = await getRedis();
  if (redis) {
    await redis.set(key, serialized);
    return;
  }
  if (!process.env.VERCEL) {
    const data = readLocalFile();
    data[key] = serialized;
    writeLocalFile(data);
    return;
  }
  memoryStore[key] = serialized;
}

const LOCK_FILE_DIR = process.cwd();
const memoryLocks: Record<string, number> = {}; // key -> expiry timestamp (ms)

// Atomic acquire-or-fail lock, not a check-then-set (which has a real race
// window — a plain storeGet + storeSet pair let 3 concurrent callers all
// see "no lock yet" before any of them finishes writing one). Each backend
// uses its own actually-atomic primitive:
//  - Redis: SET key val NX EX ttl — atomic on the server itself
//  - Local file: exclusive file creation (O_EXCL), atomic at the OS level
//  - In-memory: synchronous check-and-set with no await in between
export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = await getRedis();
  if (redis) {
    const client = redis as unknown as {
      set: (k: string, v: string, opts?: { nx?: boolean; ex?: number }) => Promise<string | null>;
    };
    const result = await client.set(key, "1", { nx: true, ex: ttlSeconds });
    return result !== null;
  }

  if (!process.env.VERCEL) {
    const lockPath = path.join(LOCK_FILE_DIR, `.lock-${key}`);
    try {
      fs.writeFileSync(lockPath, String(Date.now()), { flag: "wx" }); // fails if it already exists
      return true;
    } catch {
      try {
        const age = Date.now() - Number(fs.readFileSync(lockPath, "utf-8"));
        if (age > ttlSeconds * 1000) {
          fs.writeFileSync(lockPath, String(Date.now())); // stale — take it over
          return true;
        }
      } catch {
        // ignore, fall through to false
      }
      return false;
    }
  }

  const now = Date.now();
  if (memoryLocks[key] && memoryLocks[key] > now) return false;
  memoryLocks[key] = now + ttlSeconds * 1000; // synchronous — no race window
  return true;
}

export async function releaseLock(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await (redis as unknown as { del: (k: string) => Promise<number> }).del(key);
    return;
  }
  if (!process.env.VERCEL) {
    try {
      fs.unlinkSync(path.join(LOCK_FILE_DIR, `.lock-${key}`));
    } catch {
      // already gone, fine
    }
    return;
  }
  delete memoryLocks[key];
}
