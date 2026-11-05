import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import type { ApiEnv } from "./api/routes.ts";
import { visitorOf } from "./api/visitor.ts";

const FILE_PATH = /\.[a-z0-9]+$/i;

export interface AppOptions {
  webRoot: string;
  api?: Hono<ApiEnv>;
}

export function createApp({ webRoot, api }: AppOptions): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ status: "ok" }));
  if (api) app.route("/api", api);
  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

  // The page brings the visitor's id, or its first API calls race to make one each.
  app.get("*", async (c, next) => {
    if (!FILE_PATH.test(c.req.path)) visitorOf(c);
    await next();
  });
  app.use("*", serveStatic({ root: webRoot }));
  app.get("/assets/*", (c) => c.notFound());
  app.get("*", (c, next) => (FILE_PATH.test(c.req.path) ? c.notFound() : next()));
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));

  return app;
}
