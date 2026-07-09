import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { runDiscoveryAndSave } from "@/lib/orchestrate";
import { dispatchGithubDiscovery } from "@/lib/github";
import { isAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const meta = await store.getMeta();
  const agentStatuses = await store.getAgentStatuses();
  return NextResponse.json({ meta, agentStatuses });
}

// POST: trigger a discovery sweep right now.
// - On Vercel: dispatches the GitHub Actions workflow (no 60s cap there)
//   instead of running inline, and returns immediately.
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
    const result = await dispatchGithubDiscovery();
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 500 });
    }
    await store.setMeta({ lastDispatchedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, status: "dispatched" });
  }

  const result = await runDiscoveryAndSave("manual trigger (local)");
  return NextResponse.json({ ok: true, status: "completed", ...result });
}
