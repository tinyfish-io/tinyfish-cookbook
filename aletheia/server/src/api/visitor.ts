import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

const VISITOR_COOKIE = "aletheia_visitor";
const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The browser's own id, made on its first request. Its runs and sign-ins belong to it. */
export function visitorOf(c: Context): string {
  const known = getCookie(c, VISITOR_COOKIE);
  if (known && VISITOR_ID.test(known)) return known;

  const visitorId = randomUUID();
  setCookie(c, VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: c.req.header("x-forwarded-proto") === "https",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return visitorId;
}
