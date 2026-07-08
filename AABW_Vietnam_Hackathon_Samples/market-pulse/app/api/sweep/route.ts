import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { runSweepAndSave } from "@/lib/orchestrate";
import { dispatchGithubSweep } from "@/lib/github";
import { isAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const meta = await store.getMeta();
  const agentStatuses = await store.getAgentStatuses();
  return NextResponse.json({ meta, agentStatuses });
}

// Manually clears a stuck "sweep in progress" marker — e.g. if a previous
// run was killed mid-sweep (server restarted, process crashed) and left
// sweepStartedAt set with no matching completion. This is the fast path;
// the frontend also self-heals this after 10 minutes on its own, but
// there's no reason to make you wait when you know it's actually dead.
export async function DELETE(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const meta = await store.getMeta();
  await store.setMeta({ sweepStartedAt: meta.lastSweepAt });
  return NextResponse.json({ ok: true });
}

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

  // Local dev: fire the sweep in the background rather than awaiting full
  // completion here. Real multi-site agent runs take minutes — blocking
  // this response the whole time made the UI look frozen even though the
  // store was actually updating progressively underneath. The frontend
  // polls /api/sweep and /api/products every 8s and will pick up each
  // site's results as they land, same as the local-dev bootstrap already does.
  runSweepAndSave("manual trigger (local)").catch((err) => console.error("[sweep] manual trigger failed:", err));
  return NextResponse.json({ ok: true, status: "started" });
}
