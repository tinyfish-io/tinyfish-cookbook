import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const writes = new Map<string, Promise<void>>();

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

async function replaceFile(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, text);
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}

/** Writes to one path run in order, and each lands whole, so a crash never leaves half a file. */
export async function writeJson(path: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value, null, 2);
  const previous = writes.get(path) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => replaceFile(path, text));
  writes.set(path, next);
  try {
    await next;
  } finally {
    if (writes.get(path) === next) writes.delete(path);
  }
}
