import { NextRequest, NextResponse } from "next/server";
import { runSweepStreaming, getState } from "@/lib/sweep";
import { dispatchSweepWorkflow } from "@/lib/github";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// "Refresh rates now" button. If GITHUB_TOKEN/GITHUB_REPO are configured,
// this dispatches the GitHub Actions workflow to run for real (same
// script the daily schedule uses) and returns immediately — the update
// lands in Redis within a minute or two, picked up by the frontend's
// normal 30s poll, exactly like manually clicking "Run workflow" on
// GitHub and then refreshing Vercel. Without those two env vars set
// (e.g. local dev), it just runs the sweep inline instead.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dispatched = await dispatchSweepWorkflow();
  if (dispatched) {
    const state = await getState();
    return NextResponse.json({ ...state, dispatched: true });
  }

  const state = await runSweepStreaming(() => {});
  return NextResponse.json({ ...state, dispatched: false });
}
