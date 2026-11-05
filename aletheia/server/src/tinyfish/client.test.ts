import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { loadRun } from "../testing/fixtures.ts";
import { TinyFishClient, TinyFishError } from "./client.ts";

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

const KEY = "test-key";
const request = { url: "https://example.test", goal: "buy a laptop", proxyCountry: "IN" };

describe("TinyFishClient", () => {
  let server: Server;
  let baseUrl: string;
  let handler: Handler;
  let seen: { method: string; path: string; key: string | undefined; body: string }[];

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        seen.push({
          method: req.method ?? "",
          path: req.url ?? "",
          key: req.headers["x-api-key"] as string | undefined,
          body,
        });
        handler(req, res, body);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  afterEach(() => {
    seen = [];
  });

  seen = [];

  function client() {
    return new TinyFishClient({ apiKey: KEY, baseUrl });
  }

  function json(status: number, value: unknown): Handler {
    return (_req, res) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
  }

  it("streams a run's events in order with the settings every audit needs", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      for (const event of [
        { type: "STARTED", run_id: "run-1", timestamp: "2026-11-01T00:00:00Z" },
        {
          type: "STREAMING_URL",
          run_id: "run-1",
          streaming_url: "https://live.test/1",
          timestamp: "2026-11-01T00:00:01Z",
        },
        { type: "HEARTBEAT", timestamp: "2026-11-01T00:00:02Z" },
        {
          type: "PROGRESS",
          run_id: "run-1",
          purpose: "Open the cart",
          timestamp: "2026-11-01T00:00:03Z",
        },
        {
          type: "COMPLETE",
          run_id: "run-1",
          status: "COMPLETED",
          result: { final_price: 81 },
          error: null,
          timestamp: "2026-11-01T00:00:04Z",
        },
      ]) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
    };

    const events = [];
    for await (const event of client().streamRun({ ...request, maxDurationSeconds: 300 })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "started", runId: "run-1" },
      { type: "live", runId: "run-1", streamingUrl: "https://live.test/1" },
      { type: "progress", runId: "run-1", text: "Open the cart", at: "2026-11-01T00:00:03Z" },
      { type: "complete", runId: "run-1", status: "COMPLETED" },
    ]);
    const sent = seen[0];
    expect(sent?.path).toBe("/v1/automation/run-sse");
    expect(sent?.key).toBe(KEY);
    expect(JSON.parse(sent?.body ?? "{}")).toMatchObject({
      url: request.url,
      goal: request.goal,
      browser_profile: "stealth",
      proxy_config: { enabled: true, country_code: "IN" },
      agent_config: { max_duration_seconds: 300 },
      capture_config: { html: true },
    });
  });

  it("leaves the country out of the proxy when there is none to give", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end();
    };

    for await (const event of client().streamRun({
      ...request,
      maxDurationSeconds: 300,
      proxyCountry: null,
    })) {
      expect(event).toBeDefined();
    }

    expect(JSON.parse(seen[0]?.body ?? "{}")).toMatchObject({ proxy_config: { enabled: true } });
    expect(seen[0]?.body).not.toContain("country_code");
  });

  it("attaches a saved sign-in only when there is one", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end();
    };

    for await (const event of client().streamRun({
      ...request,
      maxDurationSeconds: 450,
      profileId: "prof_1",
    })) {
      expect(event).toBeUndefined();
    }
    for await (const event of client().streamRun({ ...request, maxDurationSeconds: 300 })) {
      expect(event).toBeUndefined();
    }

    expect(JSON.parse(seen[0]?.body ?? "{}")).toMatchObject({
      use_profile: true,
      profile_id: "prof_1",
    });
    expect(JSON.parse(seen[1]?.body ?? "{}")).not.toHaveProperty("use_profile");
  });

  it("never retries a run start, since a retry would be a second billed run", async () => {
    handler = json(500, { error: { code: "INTERNAL_ERROR", message: "boom" } });

    await expect(async () => {
      for await (const event of client().streamRun({ ...request, maxDurationSeconds: 300 })) {
        expect(event).toBeUndefined();
      }
    }).rejects.toThrow();

    expect(seen).toHaveLength(1);
  });

  it("reads a whole run record, including the steps the sdk drops", async () => {
    handler = json(200, loadRun("blinkit-2"));

    const run = await client().getRun("c22be132");

    expect(seen[0]?.path).toBe("/v1/runs/c22be132");
    expect(run.status).toBe("COMPLETED");
    expect(run.steps).toHaveLength(18);
  });

  it("cancels a run by id", async () => {
    handler = json(200, {
      run_id: "run-1",
      status: "CANCELLED",
      cancelled_at: null,
      message: null,
    });

    await client().cancelRun("run-1");

    expect(seen[0]).toMatchObject({ method: "POST", path: "/v1/runs/run-1/cancel", key: KEY });
  });

  it("fetches a step screenshot from the path that carries /v1", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(Buffer.from([0xff, 0xd8, 0xff]));
    };

    const image = await client().getScreenshot("run-1", "step-1");

    expect(seen[0]?.path).toBe("/v1/runs/run-1/steps/step-1/screenshot");
    expect([...image]).toEqual([0xff, 0xd8, 0xff]);
  });

  it("fetches the page html saved at a step", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<p>Bill</p>");
    };

    const html = await client().getStepHtml("run-1", "step-1");

    expect(seen[0]?.path).toBe("/v1/runs/run-1/steps/step-1/html");
    expect(html).toBe("<p>Bill</p>");
  });

  it("creates and deletes a profile", async () => {
    handler = json(200, { id: "prof_1", name: "x" });
    const id = await client().createProfile("Aletheia one check", "IN");
    handler = (_req, res) => {
      res.writeHead(204);
      res.end();
    };
    await client().deleteProfile(id);

    expect(id).toBe("prof_1");
    expect(JSON.parse(seen[0]?.body ?? "{}")).toEqual({
      name: "Aletheia one check",
      proxy_country_code: "IN",
    });
    expect(seen[1]).toMatchObject({ method: "DELETE", path: "/v1/profiles/prof_1" });
  });

  it("creates a profile with no country when there is none to give", async () => {
    handler = json(200, { id: "prof_1", name: "x" });
    await client().createProfile("Aletheia one check", null);
    expect(JSON.parse(seen[0]?.body ?? "{}")).toEqual({ name: "Aletheia one check" });
  });

  it("treats a profile that is already gone as deleted", async () => {
    handler = json(404, { error: { code: "NOT_FOUND", message: "gone" } });

    await expect(client().deleteProfile("prof_1")).resolves.toBeUndefined();
  });

  it("starts, saves and cancels a sign-in setup session", async () => {
    handler = json(200, {
      session_id: "sess_1",
      cdp_url: "wss://cdp.test/1",
      base_url: "https://session.test",
      timeout_seconds: 900,
      expires_at: "2026-11-01T00:15:00.000Z",
    });
    const session = await client().startSetup("prof_1", "https://example.test/login");

    handler = json(200, {
      domains_updated: ["example.test"],
      domains_failed: [],
      cookie_count: 4,
      domains_skipped: {
        cookies_skipped: [],
        local_storage_skipped: [],
        session_storage_skipped: [],
        blob_too_large: [],
      },
    });
    await client().saveSetup("prof_1", "sess_1", "example.test");

    handler = json(200, { cancelled: true });
    await client().cancelSetup("prof_1", "sess_1");

    expect(session).toEqual({
      sessionId: "sess_1",
      cdpUrl: "wss://cdp.test/1",
      expiresAt: "2026-11-01T00:15:00.000Z",
    });
    expect(JSON.parse(seen[0]?.body ?? "{}")).toMatchObject({
      url: "https://example.test/login",
      timeout_seconds: 900,
    });
    expect(JSON.parse(seen[1]?.body ?? "{}")).toEqual({
      session_id: "sess_1",
      signed_in_sites: ["example.test"],
    });
    expect(seen[2]?.path).toBe("/v1/profiles/prof_1/setup-session/cancel");
  });

  it("reports a save with nothing to capture as a typed conflict", async () => {
    handler = json(409, { error: { code: "RETRY_REQUIRED", message: "No savable browser state" } });

    const error = await client()
      .saveSetup("prof_1", "sess_1", "example.test")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TinyFishError);
    expect((error as TinyFishError).status).toBe(409);
  });

  it("raises a typed error without the key in it", async () => {
    handler = json(401, { error: { code: "INVALID_API_KEY", message: "bad key" } });

    const error = await client()
      .getRun("run-1")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TinyFishError);
    expect((error as TinyFishError).status).toBe(401);
    expect(String(error)).not.toContain(KEY);
  });
});
