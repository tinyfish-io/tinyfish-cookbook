import type { Context } from "hono";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import type { AuditService, NewAudit } from "../audit/service.ts";
import { ApiError } from "../errors.ts";
import { proxyCountry, resolveCity, resolveCountry } from "../plan/country.ts";
import { examplesFor } from "../plan/examples.ts";
import type { SitePlanner } from "../plan/planner.ts";
import type { RunQueue } from "../runner/queue.ts";
import type { Frame } from "../signin/loginBrowser.ts";
import type { SignInService } from "../signin/service.ts";
import type { AuditStore } from "../store/auditStore.ts";
import { RateLimiter } from "./rateLimit.ts";
import { visitorOf } from "./visitor.ts";
import { ownerView, sharedView, summaryView } from "./views.ts";

const STEP_ID = /^[A-Za-z0-9_-]+$/;
const LOCAL_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[.*\])$/i;
const KEEP_ALIVE_MS = 20_000;
const HOUR_MS = 60 * 60 * 1000;

export interface ApiLimits {
  perVisitor: number;
  perAddress: number;
  maxWaiting: number;
  /** Plans run as a visitor types, and each can spend one search. */
  plansPerVisitor: number;
}

const DEFAULT_LIMITS: ApiLimits = {
  perVisitor: 6,
  perAddress: 60,
  maxWaiting: 12,
  plansPerVisitor: 240,
};

export interface ApiDeps {
  audits: AuditService;
  signIns: SignInService;
  store: AuditStore;
  queue: RunQueue;
  client: { getScreenshot(runId: string, stepId: string): Promise<Uint8Array> };
  planner: SitePlanner;
  limits?: Partial<ApiLimits>;
}

export interface ApiEnv {
  Variables: { visitorId: string };
}

const siteUrl = z
  .url({ protocol: /^https?$/ })
  .max(2000)
  .refine((url) => !LOCAL_HOST.test(new URL(url).hostname), "Only public sites can be audited");

/** What the browser knows about where it is, for when no country header arrives. */
const placeSignals = {
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  timeZone: z.string().max(64).optional(),
  languages: z.array(z.string().max(35)).max(10).optional(),
};

const planSchema = z.object({ task: z.string().trim().max(300), ...placeSignals });

const newAuditSchema = z.object({
  task: z.string().trim().min(3).max(300),
  flow: z.enum(["checkout", "subscription"]).optional(),
  ...placeSignals,
  sites: z
    .array(z.object({ url: siteUrl, signInId: z.uuid().optional() }))
    .min(1)
    .max(4)
    .optional(),
});

const signInStartSchema = z.object({ url: siteUrl, ...placeSignals });

const coordinate = z.number().finite().min(-20_000).max(20_000);

const signInInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("click"), x: coordinate, y: coordinate }),
  z.object({ kind: z.literal("key"), key: z.string().min(1).max(32) }),
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(256) }),
  z.object({ kind: z.literal("scroll"), dx: coordinate, dy: coordinate }),
]);

const viewportSide = z.number().int().min(240).max(2400);

const signInActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("answer"),
    stepId: z.number().int().min(0),
    text: z.string().min(1).max(256),
    dialCode: z
      .string()
      .regex(/^\+\d{1,4}$/)
      .optional(),
  }),
  z.object({ kind: z.literal("choose"), optionId: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("resend") }),
  z.object({ kind: z.literal("refresh") }),
  z.object({ kind: z.literal("restart") }),
  z.object({ kind: z.literal("manual"), width: viewportSide, height: viewportSide }),
  z.object({ kind: z.literal("resume") }),
]);

/** Lets a stream sleep until there is something new, so slow readers only get the latest state. */
class Wakeup {
  #wake: (() => void) | undefined;

  ring(): void {
    this.#wake?.();
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.#wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
}

type PlaceSignals = Pick<z.infer<typeof planSchema>, "country" | "timeZone" | "languages">;

function countryOf(c: Context, { country, timeZone, languages }: PlaceSignals): string | null {
  const cloudflare = c.req.header("cf-ipcountry");
  return resolveCountry({ choice: country, cloudflare, timeZone, languages });
}

/** A city only holds for the country the visitor is really in, not one picked on a report. */
function cityOf(c: Context, country: string | null): string | null {
  const here = c.req.header("cf-ipcountry")?.toUpperCase();
  if (!country || country !== here) return null;
  return resolveCity(c.req.header("cf-ipcity"), c.req.header("cf-region"));
}

function clientAddress(c: Context): string {
  // The last hop is the one our own proxy added, and a visitor cannot forge that.
  return c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "direct";
}

async function jsonBody(c: Context): Promise<unknown> {
  return c.req.json().catch(() => {
    throw new ApiError("invalid_request", "The request body is not valid JSON.");
  });
}

function parsed<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError("invalid_request", result.error.issues[0]?.message ?? "Invalid request.");
  }
  return result.data;
}

export function createApi(deps: ApiDeps): Hono<ApiEnv> {
  const { audits, signIns, store, queue, client, planner } = deps;
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const byVisitor = new RateLimiter(limits.perVisitor, HOUR_MS);
  const byAddress = new RateLimiter(limits.perAddress, HOUR_MS);
  const plans = new RateLimiter(limits.plansPerVisitor, HOUR_MS);
  const api = new Hono<ApiEnv>();

  function spend(c: Context<ApiEnv>, runs: number): void {
    const visitorId = c.get("visitorId");
    const address = clientAddress(c);
    if (!byVisitor.has(visitorId, runs) || !byAddress.has(address, runs)) {
      throw new ApiError(
        "rate_limited",
        "That is the limit for this hour. Please try again later.",
      );
    }
    byVisitor.take(visitorId, runs);
    byAddress.take(address, runs);
  }

  api.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json({ error: error.code, message: error.message }, error.status);
    }
    // Only the name: a message could carry what someone typed into the sign-in panel.
    console.error(`Request failed: ${c.req.method} ${c.req.routePath} ${error.name}`);
    return c.json({ error: "internal", message: "Something went wrong on our side." }, 500);
  });

  api.use("*", async (c, next) => {
    c.set("visitorId", visitorOf(c));
    await next();
  });

  api.post("/plan", async (c) => {
    const body = parsed(planSchema, await jsonBody(c));
    if (!plans.take(c.get("visitorId"), 1)) {
      throw new ApiError("rate_limited", "That is the limit for this hour.");
    }
    const country = countryOf(c, body);
    return c.json({ ...(await planner.plan(body.task, country)), city: cityOf(c, country) });
  });

  api.post("/examples", async (c) => {
    const body = parsed(z.object(placeSignals), await jsonBody(c));
    return c.json({ examples: examplesFor(countryOf(c, body)) });
  });

  api.get("/audits", (c) => c.json({ audits: audits.list(c.get("visitorId")).map(summaryView) }));

  api.post("/audits", async (c) => {
    const body = parsed(newAuditSchema, await jsonBody(c));
    const visitorId = c.get("visitorId");
    const country = countryOf(c, body);

    const plan = body.sites && body.flow ? null : await planner.plan(body.task, country);
    const flow = body.flow ?? plan?.flow;
    const picked = (plan?.sites ?? []).filter(({ url }) => siteUrl.safeParse(url).success);
    const sites: NewAudit["sites"] = body.sites ?? picked.map(({ url }) => ({ url }));
    if (sites.length === 0) {
      throw new ApiError(
        "invalid_request",
        plan?.question?.text ?? "No sites could be picked for that. Please add one.",
      );
    }

    for (const { url, signInId } of sites) {
      if (!signInId) continue;
      const { host } = signIns.view(visitorId, signInId);
      if (new URL(url).hostname.replace(/^www\./, "") !== host) {
        throw new ApiError("invalid_request", "That sign-in belongs to a different site.");
      }
    }
    if (queue.waiting >= limits.maxWaiting) {
      throw new ApiError("busy", "Too many audits are waiting. Please try again in a few minutes.");
    }

    spend(c, sites.length);
    const city = cityOf(c, country);
    const audit = await audits.create({ task: body.task, flow, country, city, sites, visitorId });
    return c.json(ownerView(audit), 201);
  });

  api.get("/audits/:id", (c) =>
    c.json(ownerView(audits.get(c.get("visitorId"), c.req.param("id")))),
  );

  api.delete("/audits/:id", async (c) => {
    await audits.remove(c.get("visitorId"), c.req.param("id"));
    return c.body(null, 204);
  });

  api.delete("/audits/:id/sites/:siteId", async (c) => {
    await audits.removeSite(c.get("visitorId"), c.req.param("id"), c.req.param("siteId"));
    return c.body(null, 204);
  });

  api.post("/audits/:id/share", async (c) => {
    const token = await audits.share(c.get("visitorId"), c.req.param("id"));
    return c.json({ token });
  });

  api.get("/audits/:id/events", (c) => {
    const visitorId = c.get("visitorId");
    const id = c.req.param("id");
    const wakeup = new Wakeup();
    let changed = true;
    const unsubscribe = audits.subscribe(visitorId, id, () => {
      changed = true;
      wakeup.ring();
    });

    return streamSSE(c, async (stream) => {
      stream.onAbort(() => wakeup.ring());
      try {
        while (!stream.aborted) {
          if (!changed) {
            await wakeup.wait(KEEP_ALIVE_MS);
            if (!changed) await stream.write(": keep-alive\n\n");
            continue;
          }
          changed = false;
          const audit = audits.get(visitorId, id);
          await stream.writeSSE({ event: "audit", data: JSON.stringify(ownerView(audit)) });
          if (audit.status === "finished") return;
        }
      } catch (error) {
        // The audit was deleted while someone was watching, which just ends the stream.
        if (!(error instanceof ApiError)) throw error;
      } finally {
        unsubscribe();
      }
    });
  });

  async function screenshot(c: Context<ApiEnv>, auditId: string, runId: string | null) {
    const stepId = c.req.param("stepId") ?? "";
    if (!STEP_ID.test(stepId)) throw new ApiError("invalid_request", "That is not a step id.");
    if (!runId) throw new ApiError("not_found", "This site has no run.");

    let image = await store.readScreenshot(auditId, stepId);
    if (!image) {
      image = await client.getScreenshot(runId, stepId).catch(() => {
        throw new ApiError("not_found", "That screenshot is not available.");
      });
      await store.saveScreenshot(auditId, stepId, image);
    }
    return c.body(Uint8Array.from(image), 200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    });
  }

  api.get("/audits/:id/sites/:siteId/steps/:stepId/screenshot", (c) => {
    const audit = audits.get(c.get("visitorId"), c.req.param("id"));
    const site = audit.sites.find((entry) => entry.id === c.req.param("siteId"));
    return screenshot(c, audit.id, site?.runId ?? null);
  });

  api.get("/shared/:token", (c) => c.json(sharedView(audits.shared(c.req.param("token")))));

  api.get("/shared/:token/sites/:siteId/steps/:stepId/screenshot", (c) => {
    const audit = audits.shared(c.req.param("token"));
    const site = audit.sites.find((entry) => entry.id === c.req.param("siteId"));
    return screenshot(c, audit.id, site?.runId ?? null);
  });

  api.post("/signin", async (c) => {
    const { url, ...place } = parsed(signInStartSchema, await jsonBody(c));
    spend(c, 1);
    const proxy = proxyCountry(countryOf(c, place));
    return c.json(await signIns.start(c.get("visitorId"), url, proxy), 201);
  });

  api.get("/signin/:id", (c) => c.json(signIns.view(c.get("visitorId"), c.req.param("id"))));

  api.delete("/signin/:id", async (c) => {
    await signIns.signOut(c.get("visitorId"), c.req.param("id"));
    return c.body(null, 204);
  });

  api.post("/signin/:id/act", async (c) => {
    const action = parsed(signInActionSchema, await jsonBody(c));
    return c.json(await signIns.act(c.get("visitorId"), c.req.param("id"), action));
  });

  api.post("/signin/:id/input", async (c) => {
    const input = parsed(signInInputSchema, await jsonBody(c));
    await signIns.input(c.get("visitorId"), c.req.param("id"), input);
    return c.body(null, 204);
  });

  api.get("/signin/:id/screen", (c) => {
    const visitorId = c.get("visitorId");
    const id = c.req.param("id");
    const wakeup = new Wakeup();
    let frame: Frame | null = null;
    const unwatch = signIns.watch(visitorId, id, (next) => {
      frame = next;
      wakeup.ring();
    });

    return streamSSE(c, async (stream) => {
      stream.onAbort(() => wakeup.ring());
      try {
        while (!stream.aborted) {
          const latest: Frame | null = frame;
          frame = null;
          if (latest) {
            await stream.writeSSE({ event: "frame", data: JSON.stringify(latest) });
            continue;
          }
          await wakeup.wait(KEEP_ALIVE_MS);
          signIns.view(visitorId, id);
          if (!frame) await stream.write(": keep-alive\n\n");
        }
      } catch (error) {
        // The sign-in ended, which just ends the stream.
        if (!(error instanceof ApiError)) throw error;
      } finally {
        unwatch();
      }
    });
  });

  return api;
}
