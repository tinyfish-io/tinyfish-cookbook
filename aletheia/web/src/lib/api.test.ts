import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  ApiFailure,
  deleteAudit,
  deleteSite,
  listAudits,
  planAudit,
  screenshotUrl,
  startAudit,
} from "./api.ts";

function reply(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

describe("api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the list of audits", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { audits: [] })));
    await expect(listAudits()).resolves.toEqual([]);
  });

  it("posts a new audit as json", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(201, { id: "a1" }));
    vi.stubGlobal("fetch", fetchMock);

    await startAudit({ task: "Buy a laptop", sites: [{ url: "https://a.test/" }] });

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/audits");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      task: "Buy a laptop",
      sites: [{ url: "https://a.test/" }],
    });
  });

  it("deletes one site's report by its id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteSite("a1", "s1");

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/audits/a1/sites/s1");
    expect(init.method).toBe("DELETE");
  });

  it("sends where the browser is, for when no country header reaches the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { sites: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await planAudit("Buy a laptop");

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/plan");
    expect(JSON.parse(init.body as string)).toMatchObject({
      task: "Buy a laptop",
      timeZone: expect.any(String) as string,
      languages: expect.any(Array) as string[],
    });
  });

  it("accepts an empty reply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(204)));
    await expect(deleteAudit("a1")).resolves.toBeUndefined();
  });

  it("carries the server's own message on an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(reply(429, { error: "rate_limited", message: "That is the limit." })),
    );
    const failure = await listAudits().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect(failure).toMatchObject({ code: "rate_limited", message: "That is the limit." });
  });

  it("explains an error that came without a message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));
    await expect(listAudits()).rejects.toMatchObject({
      code: "unknown",
      message: "The server did not answer properly. Please try again.",
    });
  });

  it("explains a dropped connection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(listAudits()).rejects.toMatchObject({
      code: "offline",
      message: "Could not reach Aletheia. Check your connection and try again.",
    });
  });
});

describe("screenshotUrl", () => {
  it("goes through the owner's route", () => {
    expect(screenshotUrl({ kind: "owner", auditId: "a1" }, "s1", "step_2")).toBe(
      "/api/audits/a1/sites/s1/steps/step_2/screenshot",
    );
  });

  it("goes through the shared route for a visitor with a link", () => {
    expect(screenshotUrl({ kind: "shared", token: "tok" }, "s1", "step_2")).toBe(
      "/api/shared/tok/sites/s1/steps/step_2/screenshot",
    );
  });
});
