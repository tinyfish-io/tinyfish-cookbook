import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded, runSweepAndMaybeAnalyze, bootstrapLocalDevIfNeeded } from "@/lib/orchestrate";
import { dispatchGithubSweep } from "@/lib/github";
import { isAuthorized } from "@/lib/auth";

// Never statically pre-render this at build time — it depends on live
// Redis/env state that may not be ready during the Vercel build step,
// and should always reflect the current request anyway.
export const dynamic = "force-dynamic";

export const maxDuration = 60;

// GET: read current tracked data — always side-effect-free in production.
// A new visitor opening the dashboard never triggers a sweep; sweeps only
// happen on the GitHub Actions schedule or an explicit manual trigger.
// The one exception is local dev's first-ever run (see bootstrapLocalDevIfNeeded).
export async function GET() {
  await ensureSeeded();
  bootstrapLocalDevIfNeeded();
  const priceSeries = await store.getPriceSeries();
  const agentStatuses = await store.getAgentStatuses();
  const meta = await store.getMeta();
  return NextResponse.json({ priceSeries, agentStatuses, meta, usingKv: store.usingKv });
}

// POST: trigger a sweep right now — either the "Run sweep now" button or
// Vercel Cron hitting the daily analysis check-in.
// - On Vercel: dispatches the GitHub Actions workflow (which has no 60s
//   cap) instead of running the sweep inline, and returns immediately.
// - Locally: runs the full sweep inline, since there's no duration limit.
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.VERCEL) {
    const meta = await store.getMeta();
    const debounceMs = 2 * 60 * 1000;
    if (meta.lastDispatchedAt && Date.now() - new Date(meta.lastDispatchedAt).getTime() < debounceMs) {
      return NextResponse.json({ ok: true, status: "already_triggered" });
    }
    const result = await dispatchGithubSweep();
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 500 });
    }
    await store.setMeta({ lastDispatchedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, status: "dispatched" });
  }

  const result = await runSweepAndMaybeAnalyze("manual Run sweep now button (local)");
  return NextResponse.json({ ok: true, status: "completed", ...result });
}
