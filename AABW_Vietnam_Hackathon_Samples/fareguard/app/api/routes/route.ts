import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { RouteInfo } from "@/lib/types";

// Never statically pre-render this at build time — it depends on live
// Redis/env state that may not be ready during the Vercel build step,
// and should always reflect the current request anyway.
export const dynamic = "force-dynamic";

export async function GET() {
  const routes = await store.getRoutes();
  return NextResponse.json({ routes });
}

// Adds a new route. It'll be picked up automatically by the next sweep —
// no need to trigger anything here, agents.ts reads the current route list
// fresh from the store every time a sweep runs.
export async function POST(req: Request) {
  const body = await req.json();
  const from = String(body.from ?? "").trim().toUpperCase();
  const to = String(body.to ?? "").trim().toUpperCase();
  const fromCity = String(body.fromCity ?? "").trim();
  const toCity = String(body.toCity ?? "").trim();

  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return NextResponse.json({ error: "Airport codes must be 3 letters (e.g. HAN, SGN)" }, { status: 400 });
  }
  if (!fromCity || !toCity) {
    return NextResponse.json({ error: "City names are required" }, { status: 400 });
  }
  if (from === to) {
    return NextResponse.json({ error: "Origin and destination can't be the same" }, { status: 400 });
  }

  const code = `${from}-${to}`;
  const existing = await store.getRoutes();
  if (existing.some((r) => r.code === code)) {
    return NextResponse.json({ error: "That route is already being monitored" }, { status: 400 });
  }

  const newRoute: RouteInfo = { code, from, fromCity, to, toCity, label: `${fromCity} to ${toCity}` };
  await store.setRoutes([...existing, newRoute]);

  return NextResponse.json({ route: newRoute });
}
