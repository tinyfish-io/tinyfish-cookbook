import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { AuditService } from "../audit/service.ts";
import { RunQueue } from "../runner/queue.ts";
import { SignInService } from "../signin/service.ts";
import { AuditStore } from "../store/auditStore.ts";
import { SitePlanner } from "../plan/planner.ts";
import { fakeBrowser } from "../testing/fakeBrowser.ts";
import { loadRun, pageOf, withSavedPages } from "../testing/fixtures.ts";
import type { RunEvent } from "../tinyfish/client.ts";
import type { RunRecord } from "../tinyfish/types.ts";
import type { ApiLimits } from "./routes.ts";
import { createApi } from "./routes.ts";

const SECRET = "tf-secret-key";

const readdirOrEmpty = (path: string) => readdir(path).catch(() => [] as string[]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff]);

describe("api", () => {
  let dataDir: string;
  let api: ReturnType<typeof createApi>;
  let run: RunRecord;
  let getScreenshot: ReturnType<typeof vi.fn<() => Promise<Uint8Array>>>;
  let browser: ReturnType<typeof fakeBrowser>;
  let signIns: SignInService;
  let limits: Partial<ApiLimits>;

  function build() {
    const client = {
      streamRun: async function* (): AsyncGenerator<RunEvent> {
        yield { type: "started", runId: run.run_id };
        yield { type: "live", runId: run.run_id, streamingUrl: "https://live.test/1" };
        yield { type: "complete", runId: run.run_id, status: run.status };
      },
      getRun: () => Promise.resolve(run),
      cancelRun: () => Promise.resolve(),
      getScreenshot,
      getStepHtml: () => Promise.resolve(pageOf(run)),
      createProfile: () => Promise.resolve("prof_1"),
      deleteProfile: () => Promise.resolve(),
      startSetup: () =>
        Promise.resolve({
          sessionId: "sess_1",
          cdpUrl: "wss://cdp.test",
          expiresAt: "2099-01-01T00:00:00.000Z",
        }),
      saveSetup: () => Promise.resolve(),
      cancelSetup: () => Promise.resolve(),
    };
    return { client };
  }

  async function setup() {
    const { client } = build();
    const store = new AuditStore(dataDir);
    await store.load();
    const queue = new RunQueue(2);
    signIns = new SignInService({
      client,
      openBrowser: () => Promise.resolve(browser),
      runLogout: () => Promise.resolve(true),
      dataDir,
      guided: { wait: () => Promise.resolve(), settlePolls: 2 },
    });
    const audits = new AuditService({
      client,
      store,
      queue,
      signIns,
      timing: { pollMs: 1, quietMs: 10_000, graceMs: 5000 },
    });
    const planner = new SitePlanner(() => Promise.resolve([]));
    api = createApi({ audits, signIns, store, queue, client, planner, limits });
  }

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "aletheia-api-"));
    run = withSavedPages(loadRun("blinkit-2"));
    getScreenshot = vi.fn(() => Promise.resolve(JPEG));
    browser = fakeBrowser();
    limits = {};
    await setup();
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  function visitor(name: string) {
    let cookie = `aletheia_visitor=${name}`;
    return async (path: string, init: RequestInit = {}) => {
      const response = await api.request(path, {
        ...init,
        headers: {
          cookie,
          "content-type": "application/json",
          ...(init.headers as Record<string, string> | undefined),
        },
      });
      const set = response.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0] ?? cookie;
      return response;
    };
  }

  const alice = () => visitor("00000000-0000-4000-8000-00000000000a");
  const task = { task: "buy one pair of headphones", sites: [{ url: "https://shop.test/" }] };

  function post(body: unknown): RequestInit {
    return { method: "POST", body: JSON.stringify(body) };
  }

  async function createAudit(as: ReturnType<typeof visitor>): Promise<string> {
    const response = await as("/audits", post(task));
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    await finished(as, id);
    return id;
  }

  async function finished(as: ReturnType<typeof visitor>, id: string): Promise<void> {
    await vi.waitFor(async () => {
      const audit = (await (await as(`/audits/${id}`)).json()) as { status: string };
      expect(audit.status).toBe("finished");
    });
  }

  it("gives a new browser a visitor cookie that scripts cannot read", async () => {
    const response = await api.request("/audits");

    expect(response.headers.get("set-cookie")).toMatch(
      /aletheia_visitor=.+HttpOnly.+SameSite=Lax/i,
    );
  });

  it("marks the cookie secure behind https", async () => {
    const response = await api.request("/audits", {
      headers: { "x-forwarded-proto": "https" },
    });

    expect(response.headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("replaces a forged visitor cookie", async () => {
    const response = await api.request("/audits", { headers: { cookie: "aletheia_visitor=me" } });

    expect(response.headers.get("set-cookie")).toMatch(/aletheia_visitor=/);
  });

  it("creates an audit and returns its report", async () => {
    const as = alice();
    const id = await createAudit(as);

    const audit = (await (await as(`/audits/${id}`)).json()) as {
      visitorId?: string;
      sites: { report: { bill: { total: number } } }[];
    };

    expect(audit.sites[0]?.report.bill.total).toBe(81);
    expect(audit).not.toHaveProperty("visitorId");
  });

  it("sums up each report by severity, worst first", async () => {
    const as = alice();
    const id = await createAudit(as);

    const audit = (await (await as(`/audits/${id}`)).json()) as {
      sites: { report: { severity: unknown } }[];
    };

    expect(audit.sites[0]?.report.severity).toEqual({
      high: 1,
      medium: 0,
      low: 0,
      line: "1 high: fees added after the first price",
    });
  });

  it("reads the visitor's city from Cloudflare and never shares it", async () => {
    const as = alice();
    const headers = {
      "cf-ipcountry": "IN",
      "cf-ipcity": "Pune",
      "cf-region": "Maharashtra",
    };
    const planned = (await (
      await as("/plan", { ...post({ task: "buy a laptop" }), headers })
    ).json()) as { city: string | null };
    expect(planned.city).toBe("Pune, Maharashtra");

    const created = (await (
      await as("/audits", {
        ...post({ task: "buy a laptop", sites: [{ url: "https://shop.test/" }], flow: "checkout" }),
        headers,
      })
    ).json()) as { id: string; city: string | null };
    expect(created.city).toBe("Pune, Maharashtra");

    const { token } = (await (
      await as(`/audits/${created.id}/share`, { method: "POST" })
    ).json()) as {
      token: string;
    };
    const shared = (await (await as(`/shared/${token}`)).json()) as Record<string, unknown>;
    expect(shared).not.toHaveProperty("city");
  });

  it("drops the city when the audit runs from another country", async () => {
    const as = alice();
    const response = await as("/plan", {
      ...post({ task: "buy a laptop", country: "DE" }),
      headers: { "cf-ipcountry": "IN", "cf-ipcity": "Pune" },
    });
    const { city } = (await response.json()) as { city: string | null };
    expect(city).toBeNull();
  });

  it("lists past audits in short form", async () => {
    const as = alice();
    await createAudit(as);

    const list = (await (await as("/audits")).json()) as {
      audits: { sites: { host: string; found: number; total: number }[] }[];
    };

    expect(list.audits[0]?.sites[0]).toMatchObject({ host: "shop.test", found: 1, total: 81 });
  });

  it("deletes an audit", async () => {
    const as = alice();
    const id = await createAudit(as);

    expect((await as(`/audits/${id}`, { method: "DELETE" })).status).toBe(204);
    expect((await as(`/audits/${id}`)).status).toBe(404);
  });

  describe("deleting one site's report", () => {
    async function twoSites(as: ReturnType<typeof visitor>) {
      const response = await as(
        "/audits",
        post({
          task: "buy a laptop",
          flow: "checkout",
          sites: [{ url: "https://a.test/" }, { url: "https://b.test/" }],
        }),
      );
      const audit = (await response.json()) as {
        id: string;
        sites: { id: string; host: string }[];
      };
      await finished(as, audit.id);
      return audit;
    }

    it("keeps the rest of the audit, and drops that site's screenshots", async () => {
      const as = alice();
      const { id, sites } = await twoSites(as);
      const [first, second] = sites;
      const view = (await (await as(`/audits/${id}`)).json()) as {
        sites: { id: string; report: { pages: { screenshot: { stepId: string } | null }[] } }[];
      };
      const stepId = view.sites[0]?.report.pages.find((page) => page.screenshot)?.screenshot
        ?.stepId;
      await as(`/audits/${id}/sites/${first?.id}/steps/${stepId}/screenshot`);
      expect(getScreenshot).toHaveBeenCalledOnce();

      const removed = await as(`/audits/${id}/sites/${first?.id}`, { method: "DELETE" });
      expect(removed.status).toBe(204);

      const left = (await (await as(`/audits/${id}`)).json()) as { sites: { id: string }[] };
      expect(left.sites.map((site) => site.id)).toEqual([second?.id]);
      expect(await readdirOrEmpty(join(dataDir, "audits", id, "screenshots"))).not.toContain(
        `${stepId}.jpg`,
      );
    });

    it("deletes the whole audit with its last site", async () => {
      const as = alice();
      const id = await createAudit(as);
      const view = (await (await as(`/audits/${id}`)).json()) as { sites: { id: string }[] };

      await as(`/audits/${id}/sites/${view.sites[0]?.id}`, { method: "DELETE" });

      expect((await as(`/audits/${id}`)).status).toBe(404);
    });

    it("is refused for another visitor and for an unknown site", async () => {
      const as = alice();
      const { id, sites } = await twoSites(as);
      const bob = visitor("00000000-0000-4000-8000-00000000000b");

      expect((await bob(`/audits/${id}/sites/${sites[0]?.id}`, { method: "DELETE" })).status).toBe(
        404,
      );
      expect((await as(`/audits/${id}/sites/nope`, { method: "DELETE" })).status).toBe(404);
    });
  });

  it("hides one visitor's audits from another", async () => {
    const id = await createAudit(alice());
    const bob = visitor("00000000-0000-4000-8000-00000000000b");

    expect((await bob(`/audits/${id}`)).status).toBe(404);
    expect((await bob(`/audits/${id}`, { method: "DELETE" })).status).toBe(404);
    expect((await bob(`/audits/${id}/events`)).status).toBe(404);
  });

  it.each([
    ["no task", { sites: [{ url: "https://shop.test/" }] }],
    ["no sites", { task: "buy a laptop", sites: [] }],
    ["too many sites", { task: "buy a laptop", sites: Array(5).fill({ url: "https://a.test/" }) }],
    ["a non-web url", { task: "buy a laptop", sites: [{ url: "file:///etc/passwd" }] }],
    ["a local url", { task: "buy a laptop", sites: [{ url: "http://localhost:3000/" }] }],
    ["a private address", { task: "buy a laptop", sites: [{ url: "http://192.168.1.1/" }] }],
    ["an unknown flow", { task: "buy a laptop", flow: "x", sites: [{ url: "https://a.test/" }] }],
  ])("rejects %s", async (_name, body) => {
    expect((await alice()("/audits", post(body))).status).toBe(400);
  });

  it("limits how many sites one visitor can run", async () => {
    limits = { perVisitor: 2 };
    await setup();
    const as = alice();

    await createAudit(as);
    await createAudit(as);
    const refused = await as("/audits", post(task));

    expect(refused.status).toBe(429);
    expect(((await refused.json()) as { error: string }).error).toBe("rate_limited");
  });

  it("limits a network that keeps clearing its cookie", async () => {
    limits = { perAddress: 1 };
    await setup();
    const from = { "x-forwarded-for": "1.2.3.4" };

    const first = alice();
    const { id } = (await (await first("/audits", { ...post(task), headers: from })).json()) as {
      id: string;
    };
    const second = visitor("00000000-0000-4000-8000-00000000000b");
    const refused = await second("/audits", { ...post(task), headers: from });

    expect(refused.status).toBe(429);
    await finished(first, id);
  });

  it("streams the current state first, then ends when the audit is finished", async () => {
    const as = alice();
    const id = await createAudit(as);

    const response = await as(`/audits/${id}/events`);
    const text = await response.text();

    expect(response.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(text).toContain("event: audit");
    expect(text).toContain('"status":"finished"');
  });

  it("includes a comparison once sites have reports", async () => {
    const as = alice();
    const response = await as(
      "/audits",
      post({
        task: "buy a laptop",
        sites: [{ url: "https://a.test/" }, { url: "https://b.test/" }],
      }),
    );
    const { id } = (await response.json()) as { id: string };

    await vi.waitFor(async () => {
      const audit = (await (await as(`/audits/${id}`)).json()) as {
        comparison: { rows: unknown[] } | null;
      };
      expect(audit.comparison?.rows).toHaveLength(2);
    });
    await finished(as, id);
  });

  describe("screenshots", () => {
    async function shotPath(as: ReturnType<typeof visitor>, id: string) {
      const audit = (await (await as(`/audits/${id}`)).json()) as {
        sites: {
          id: string;
          report: { patterns: { id: string; screenshot: { stepId: string } | null }[] };
        }[];
      };
      const site = audit.sites[0];
      const stepId = site?.report.patterns.find((entry) => entry.screenshot)?.screenshot?.stepId;
      return `/audits/${id}/sites/${site?.id}/steps/${stepId}/screenshot`;
    }

    it("proxies the image, so the key stays on the server, and keeps a copy", async () => {
      const as = alice();
      const path = await shotPath(as, await createAudit(as));

      const first = await as(path);
      const second = await as(path);

      expect(first.headers.get("content-type")).toBe("image/jpeg");
      expect(new Uint8Array(await first.arrayBuffer())).toEqual(JPEG);
      expect(new Uint8Array(await second.arrayBuffer())).toEqual(JPEG);
      expect(getScreenshot).toHaveBeenCalledOnce();
      expect(JSON.stringify([...first.headers])).not.toContain(SECRET);
    });

    it("keeps them from other visitors", async () => {
      const as = alice();
      const path = await shotPath(as, await createAudit(as));

      expect((await visitor("00000000-0000-4000-8000-00000000000b")(path)).status).toBe(404);
    });

    it("refuses a step id that could walk out of the folder", async () => {
      const as = alice();
      const id = await createAudit(as);
      const audit = (await (await as(`/audits/${id}`)).json()) as { sites: { id: string }[] };
      const site = audit.sites[0]?.id;

      const response = await as(`/audits/${id}/sites/${site}/steps/..%2F..%2Faudit/screenshot`);

      expect(response.status).toBe(400);
    });
  });

  describe("sharing", () => {
    it("opens a read-only copy with no visitor or sign-in details", async () => {
      const as = alice();
      const id = await createAudit(as);
      const { token } = (await (await as(`/audits/${id}/share`, { method: "POST" })).json()) as {
        token: string;
      };

      const response = await api.request(`/shared/${token}`);
      const audit = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(audit).not.toHaveProperty("visitorId");
      expect(audit).not.toHaveProperty("shareToken");
    });

    it("answers 404 for an unknown token", async () => {
      expect((await api.request("/shared/nope")).status).toBe(404);
    });
  });

  it("gives three examples for the visitor's country", async () => {
    const response = await alice()("/examples", {
      ...post({}),
      headers: { "cf-ipcountry": "DE" },
    });
    const { examples } = (await response.json()) as { examples: string[] };

    expect(examples).toHaveLength(3);
  });

  describe("planning", () => {
    interface PlanBody {
      flow: string;
      country: string | null;
      sites: { host: string }[];
    }

    async function planFor(body: unknown, headers: Record<string, string> = {}) {
      const request = post(body);
      const response = await alice()("/plan", {
        ...request,
        headers: { ...(request.headers as Record<string, string>), ...headers },
      });
      expect(response.status).toBe(200);
      return (await response.json()) as PlanBody;
    }

    it("picks the sites and the flow for a task, from Cloudflare's country", async () => {
      const plan = await planFor({ task: "buy two movie tickets" }, { "CF-IPCountry": "IN" });
      expect(plan.flow).toBe("checkout");
      expect(plan.country).toBe("IN");
      expect(plan.sites[0]?.host).toBe("district.in");
    });

    it("lets the visitor's choice and the browser stand in for the header", async () => {
      const chosen = await planFor(
        { task: "buy a laptop", country: "GB" },
        { "CF-IPCountry": "IN" },
      );
      expect(chosen.country).toBe("GB");

      const browser = await planFor({ task: "buy a laptop", timeZone: "America/Chicago" });
      expect(browser.country).toBe("US");
    });

    it("answers with the country before there is a task", async () => {
      const plan = await planFor({ task: "" }, { "CF-IPCountry": "IN" });
      expect(plan.country).toBe("IN");
      expect(plan.sites).toEqual([]);
    });

    it("refuses a malformed country", async () => {
      const response = await alice()("/plan", post({ task: "buy a laptop", country: "india" }));
      expect(response.status).toBe(400);
    });

    it("picks the sites itself when an audit names none", async () => {
      const as = alice();
      const request = post({ task: "buy two movie tickets" });
      const response = await as("/audits", {
        ...request,
        headers: { ...(request.headers as Record<string, string>), "CF-IPCountry": "IN" },
      });
      expect(response.status).toBe(201);

      const audit = (await response.json()) as {
        id: string;
        country: string;
        countryName: string;
        flow: string;
        sites: { host: string }[];
      };
      await finished(as, audit.id);
      expect(audit.country).toBe("IN");
      expect(audit.countryName).toBe("India");
      expect(audit.flow).toBe("checkout");
      expect(audit.sites.map(({ host }) => host)).toEqual(["district.in", "in.bookmyshow.com"]);
    });

    it("works out the flow for sites the visitor chose", async () => {
      const as = alice();
      const response = await as(
        "/audits",
        post({ task: "Adobe Photoshop", sites: [{ url: "https://www.adobe.com/in/" }] }),
      );
      const audit = (await response.json()) as { id: string; flow: string };
      await finished(as, audit.id);
      expect(audit.flow).toBe("subscription");
    });
  });

  describe("sign-in", () => {
    async function startSignIn(as: ReturnType<typeof visitor>) {
      const response = await as("/signin", post({ url: "https://shop.test/" }));
      expect(response.status).toBe(201);
      return (await response.json()) as { id: string; state: string; expiresAt: string };
    }

    /** Waits for the page to be read, which is what the panel polls for. */
    async function readySignIn(as: ReturnType<typeof visitor>) {
      const { id } = await startSignIn(as);
      await signIns.opened(id);
      const view = (await (await as(`/signin/${id}`)).json()) as { step: { id: number } };
      return { id, step: view.step };
    }

    it("starts a session and shows its time limit", async () => {
      const signIn = await startSignIn(alice());

      expect(signIn.state).toBe("setting_up");
      expect(signIn.expiresAt).toBeTruthy();
    });

    it("takes an answer and says what comes next, without echoing it", async () => {
      const as = alice();
      const { id, step } = await readySignIn(as);

      const response = await as(
        `/signin/${id}/act`,
        post({ kind: "answer", stepId: step.id, text: "me@mail.test" }),
      );
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(browser.enter).toHaveBeenCalledWith([{ frame: 0, ref: 1 }], "me@mail.test");
      expect(body).toContain('"state":"ready"');
      expect(body).not.toContain("me@mail.test");
    });

    it("refuses an action it does not know, without quoting it back", async () => {
      const as = alice();
      const { id, step } = await readySignIn(as);

      const response = await as(
        `/signin/${id}/act`,
        post({ kind: "answer", stepId: step.id, text: "x".repeat(257) }),
      );

      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain("xxx");
      expect(browser.enter).not.toHaveBeenCalled();
    });

    it("logs nothing of an answer when the page fails on it", async () => {
      const failure = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const as = alice();
      const { id, step } = await readySignIn(as);
      browser.enter.mockRejectedValueOnce(new Error("fill('hunter2') failed"));

      const response = await as(
        `/signin/${id}/act`,
        post({ kind: "answer", stepId: step.id, text: "hunter2" }),
      );

      expect(await response.text()).not.toContain("hunter2");
      expect(failure).not.toHaveBeenCalled();
      failure.mockRestore();
    });

    it("relays input and validates it", async () => {
      const as = alice();
      const { id } = await readySignIn(as);

      const typed = await as(`/signin/${id}/input`, post({ kind: "text", text: "98765" }));
      const bad = await as(`/signin/${id}/input`, post({ kind: "explode" }));

      expect(typed.status).toBe(204);
      expect(browser.type).toHaveBeenCalledWith("98765");
      expect(bad.status).toBe(400);
    });

    it("sends screen frames as events", async () => {
      const as = alice();
      const { id } = await readySignIn(as);

      const response = await as(`/signin/${id}/screen`);
      const reader = response.body?.getReader();
      browser.emit({ data: "abc", width: 1280, height: 720 });
      const { value } = (await reader?.read()) ?? {};
      await reader?.cancel();

      expect(new TextDecoder().decode(value)).toContain("abc");
    });

    it("runs a signed-in check after the sign-in saves", async () => {
      run = loadRun("zomato-signed-in-2");
      const as = alice();
      const { id: signInId, step } = await readySignIn(as);
      await as(
        `/signin/${signInId}/act`,
        post({ kind: "answer", stepId: step.id, text: "me@mail.test" }),
      );

      const response = await as(
        "/audits",
        post({ task: "buy a biryani", sites: [{ url: "https://shop.test/", signInId }] }),
      );

      expect(response.status).toBe(201);
      await finished(as, ((await response.json()) as { id: string }).id);
    });

    it("refuses a check before sign-in is done, and on a different site", async () => {
      const as = alice();
      const { id: signInId, step } = await readySignIn(as);

      const early = await as(
        "/audits",
        post({ task: "buy a laptop", sites: [{ url: "https://shop.test/", signInId }] }),
      );
      await as(
        `/signin/${signInId}/act`,
        post({ kind: "answer", stepId: step.id, text: "me@mail.test" }),
      );
      const elsewhere = await as(
        "/audits",
        post({ task: "buy a laptop", sites: [{ url: "https://other.test/", signInId }] }),
      );

      expect(early.status).toBe(409);
      expect(elsewhere.status).toBe(400);
    });

    it("signs out at any time", async () => {
      const as = alice();
      const { id } = await startSignIn(as);

      expect((await as(`/signin/${id}`, { method: "DELETE" })).status).toBe(204);
      expect((await as(`/signin/${id}`)).status).toBe(404);
    });
  });
});
