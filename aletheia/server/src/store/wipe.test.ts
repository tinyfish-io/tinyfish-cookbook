import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { wipeData } from "./wipe.ts";

describe("wipeData", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "aletheia-wipe-"));
    await mkdir(join(dir, "audits", "a1", "screenshots"), { recursive: true });
    await mkdir(join(dir, "audits", "a2"), { recursive: true });
    await writeFile(join(dir, "audits", "a1", "audit.json"), "{}");
    await writeFile(join(dir, "audits", "a1", "screenshots", "s1.jpg"), "image");
    await writeFile(join(dir, "login-domains.json"), '["zomato.com"]');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function saveSignIns(...profileIds: string[]) {
    const records = profileIds.map((profileId) => ({ profileId }));
    await writeFile(join(dir, "signins.json"), JSON.stringify(records));
  }

  it("removes every saved audit, screenshot and remembered login", async () => {
    const result = await wipeData({ dataDir: dir, deleteProfile: () => Promise.resolve() });

    expect(result).toEqual({ audits: 2, profilesDeleted: 0, profilesLeft: [] });
    expect(await readdir(dir)).toEqual([]);
  });

  it("deletes each sign-in's profile, which holds the site cookies", async () => {
    await saveSignIns("prof_1", "prof_2");
    const deleted: string[] = [];

    const result = await wipeData({
      dataDir: dir,
      deleteProfile: (id) => {
        deleted.push(id);
        return Promise.resolve();
      },
    });

    expect(deleted).toEqual(["prof_1", "prof_2"]);
    expect(result.profilesDeleted).toBe(2);
    expect(await readdir(dir)).toEqual([]);
  });

  it("keeps the record of a profile it could not delete, so the wipe can be run again", async () => {
    await saveSignIns("prof_1", "prof_2");

    const result = await wipeData({
      dataDir: dir,
      deleteProfile: (id) =>
        id === "prof_1" ? Promise.reject(new Error("down")) : Promise.resolve(),
    });

    expect(result.profilesLeft).toEqual(["prof_1"]);
    expect(await readdir(dir)).toEqual(["signins.json"]);
  });

  it("keeps sign-in records when it has no way to delete profiles", async () => {
    await saveSignIns("prof_1");

    const result = await wipeData({ dataDir: dir, deleteProfile: null });

    expect(result.profilesLeft).toEqual(["prof_1"]);
    expect(await readdir(dir)).toEqual(["signins.json"]);
  });

  it("leaves anything it did not create alone, in case DATA_DIR is set wrong", async () => {
    await writeFile(join(dir, "notes.txt"), "not ours");

    await wipeData({ dataDir: dir, deleteProfile: () => Promise.resolve() });

    expect(await readdir(dir)).toEqual(["notes.txt"]);
  });

  it("is fine with an empty or missing folder", async () => {
    const result = await wipeData({
      dataDir: join(dir, "missing"),
      deleteProfile: () => Promise.resolve(),
    });

    expect(result).toEqual({ audits: 0, profilesDeleted: 0, profilesLeft: [] });
  });
});
