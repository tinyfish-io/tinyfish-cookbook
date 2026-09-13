import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/orchestrate";
import { buildRecommendations } from "@/lib/analyze";
import { isAuthorized } from "@/lib/auth";

// Never statically pre-render this at build time — it depends on live
// Redis/env state that may not be ready during the Vercel build step,
// and should always reflect the current request anyway.
export const dynamic = "force-dynamic";

export const maxDuration = 60;

// GET: read the latest saved recommendations — read-only, no side effects.
export async function GET() {
  const recommendations = await store.getRecommendations();
  const meta = await store.getMeta();
  return NextResponse.json({ recommendations, meta });
}

// POST: force-recompute recommendations from the full accumulated price
// history right now. This one stays fast regardless of plan — it's a
// single Groq call, not a multi-site browser sweep — so it's fine to run
// inline whenever forced manually — the regular path is via runSweepAndMaybeAnalyze, which now runs analysis every sweep, not on a separate schedule.
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const priceSeries = await ensureSeeded();
  const routes = await store.getRoutes();
  const recommendations = await buildRecommendations(priceSeries, routes);
  await store.setRecommendations(recommendations);
  await store.setMeta({ lastAnalyzeAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, recommendations });
}
