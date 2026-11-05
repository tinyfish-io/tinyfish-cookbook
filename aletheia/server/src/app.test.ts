import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createApp } from "./app.ts";

describe("createApp", () => {
  let webRoot: string;

  beforeAll(async () => {
    webRoot = await mkdtemp(join(tmpdir(), "aletheia-web-"));
    await mkdir(join(webRoot, "assets"));
    await writeFile(join(webRoot, "index.html"), "<h1>app shell</h1>");
    await writeFile(join(webRoot, "assets", "app.js"), "console.log('bundle')");
  });

  afterAll(async () => {
    await rm(webRoot, { recursive: true, force: true });
  });

  it("reports health on the API", async () => {
    const response = await createApp({ webRoot }).request("/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers unknown API paths with JSON, never the app shell", async () => {
    const response = await createApp({ webRoot }).request("/api/nope");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("serves the built web app at the root", async () => {
    const response = await createApp({ webRoot }).request("/");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("app shell");
  });

  it("serves built assets", async () => {
    const response = await createApp({ webRoot }).request("/assets/app.js");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("bundle");
  });

  it("answers a missing file at the root with 404, so a cache cannot keep the shell as it", async () => {
    const response = await createApp({ webRoot }).request("/favicon.svg");

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("app shell");
  });

  it("still opens client routes from the app shell", async () => {
    const response = await createApp({ webRoot }).request("/audits/3f9a-77/");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("app shell");
  });

  it("answers missing assets with 404, never the app shell", async () => {
    const response = await createApp({ webRoot }).request("/assets/missing.js");

    expect(response.status).toBe(404);
  });

  it("hands a new visitor their id with the page, so the page's first calls share one", async () => {
    const app = createApp({ webRoot });

    for (const path of ["/", "/audits/42"]) {
      const response = await app.request(path);
      expect(response.headers.get("set-cookie")).toMatch(/^aletheia_visitor=[0-9a-f-]{36};/);
    }
  });

  it("keeps a visitor's id and sets no cookie on assets a cache may keep", async () => {
    const app = createApp({ webRoot });
    const known = { Cookie: "aletheia_visitor=3f9a77c2-1b2c-4d5e-8f90-a1b2c3d4e5f6" };

    expect((await app.request("/", { headers: known })).headers.get("set-cookie")).toBeNull();
    expect((await app.request("/assets/app.js")).headers.get("set-cookie")).toBeNull();
  });

  it("falls back to the app shell for client routes", async () => {
    const response = await createApp({ webRoot }).request("/audits/42");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("app shell");
  });
});
