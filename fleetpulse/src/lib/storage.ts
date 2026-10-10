import fs from "fs";
import path from "path";

let redisClient: any = null;

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    if (process.env.GITHUB_ACTIONS === "true") {
      throw new Error(
        "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN aren't set in this GitHub Actions run. Add them as " +
          "repository secrets with the exact same values as your Vercel project."
      );
    }
    return null;
  }
  if (redisClient) return redisClient;
  const { Redis } = await import("@upstash/redis");
  redisClient = new Redis({ url, token }) as any;
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
    fs.writeFileSync(LOCAL_STATE_PATH, JSON.stringify(data), "utf-8");
  } catch (err) {
    console.error("[storage] failed to write local state file:", err);
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

const memoryLocks: Record<string, number> = {};

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = await getRedis();
  if (redis) {
    const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
    return result !== null;
  }
  if (!process.env.VERCEL) {
    const lockPath = path.join(process.cwd(), `.lock-${key}`);
    try {
      fs.writeFileSync(lockPath, String(Date.now()), { flag: "wx" });
      return true;
    } catch {
      try {
        const age = Date.now() - Number(fs.readFileSync(lockPath, "utf-8"));
        if (age > ttlSeconds * 1000) {
          fs.writeFileSync(lockPath, String(Date.now()));
          return true;
        }
        return false;
      } catch {
        return true;
      }
    }
  }
  const now = Date.now();
  if (memoryLocks[key] && now - memoryLocks[key] < ttlSeconds * 1000) return false;
  memoryLocks[key] = now;
  return true;
}

export async function releaseLock(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.del(key);
    return;
  }
  if (!process.env.VERCEL) {
    try {
      fs.unlinkSync(path.join(process.cwd(), `.lock-${key}`));
    } catch {}
    return;
  }
  delete memoryLocks[key];
}
