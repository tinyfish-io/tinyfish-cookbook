import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Audit } from "../audit/types.ts";
import { readJson, writeJson } from "./jsonFile.ts";

const REMOVE_RETRIES = 5;
const REMOVE_RETRY_DELAY_MS = 50;

/** One folder per audit under DATA_DIR, so deleting an audit deletes everything it made. */
export class AuditStore {
  readonly #root: string;
  readonly #audits = new Map<string, Audit>();

  constructor(dataDir: string) {
    this.#root = join(dataDir, "audits");
  }

  async load(): Promise<void> {
    await mkdir(this.#root, { recursive: true });
    for (const id of await readdir(this.#root)) {
      const audit = await readJson<Audit>(join(this.#root, id, "audit.json"));
      if (audit) this.#audits.set(audit.id, audit);
    }
  }

  get(id: string): Audit | null {
    return this.#audits.get(id) ?? null;
  }

  all(): Audit[] {
    return [...this.#audits.values()];
  }

  async save(audit: Audit): Promise<void> {
    this.#audits.set(audit.id, audit);
    await writeJson(join(this.#root, audit.id, "audit.json"), audit);
    // A delete can land while this write is on its way, and deleted has to stay deleted.
    if (!this.#audits.has(audit.id)) await this.#removeFolder(audit.id);
  }

  async remove(id: string): Promise<void> {
    this.#audits.delete(id);
    await this.#removeFolder(id);
  }

  async readScreenshot(id: string, stepId: string): Promise<Uint8Array | null> {
    return readFile(this.#shotPath(id, stepId)).catch(() => null);
  }

  async saveScreenshot(id: string, stepId: string, image: Uint8Array): Promise<void> {
    if (!this.#audits.has(id)) return;
    const path = this.#shotPath(id, stepId);
    await mkdir(join(this.#root, id, "screenshots"), { recursive: true });
    await writeFile(path, image);
  }

  async removeScreenshots(id: string, stepIds: readonly string[]): Promise<void> {
    await Promise.all(stepIds.map((stepId) => rm(this.#shotPath(id, stepId), { force: true })));
  }

  async #removeFolder(id: string): Promise<void> {
    await rm(join(this.#root, id), {
      recursive: true,
      force: true,
      maxRetries: REMOVE_RETRIES,
      retryDelay: REMOVE_RETRY_DELAY_MS,
    });
  }

  #shotPath(id: string, stepId: string): string {
    return join(this.#root, id, "screenshots", `${stepId}.jpg`);
  }
}
