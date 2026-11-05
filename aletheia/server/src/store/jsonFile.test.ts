import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { readJson, writeJson } from "./jsonFile.ts";

describe("json files", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "aletheia-json-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips a value and creates missing folders", async () => {
    const path = join(dir, "a", "b.json");

    await writeJson(path, { hello: "world" });

    expect(await readJson(path)).toEqual({ hello: "world" });
  });

  it("answers null for a missing file", async () => {
    expect(await readJson(join(dir, "none.json"))).toBeNull();
  });

  it("answers null for a damaged file, rather than stopping the server from booting", async () => {
    const path = join(dir, "bad.json");
    await writeFile(path, "{ half a file");

    expect(await readJson(path)).toBeNull();
  });

  it("leaves no temp files, and the last of many overlapping writes wins", async () => {
    const path = join(dir, "c.json");

    await Promise.all(Array.from({ length: 20 }, (_, n) => writeJson(path, { n })));

    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ n: 19 });
    expect(await readdir(dir)).toEqual(["c.json"]);
  });
});
