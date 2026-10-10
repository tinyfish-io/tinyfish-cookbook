import { NextResponse } from "next/server";
import { runSweep } from "@/lib/orchestrate";
import { dispatchSweepWorkflow } from "@/lib/github";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Manually force-sweeps just this one search, bypassing the normal 48h
// due-check — same idea as the other apps' "Sync now," scoped per search.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (process.env.VERCEL) {
    const dispatched = await dispatchSweepWorkflow();
    // Note: dispatching runs the normal due-check sweep, not scoped to this
    // one search specifically — GitHub Actions has no way to receive that
    // scope via workflow_dispatch here without more plumbing. Good enough
    // for now: this search will pick up on the next daily run regardless,
    // and this button's main value locally is the immediate forced check.
    return NextResponse.json({ ok: dispatched, status: dispatched ? "dispatched" : "not_configured" });
  }
  const result = await runSweep(`manual force-sweep for ${params.id}`, [params.id]);
  return NextResponse.json({ ok: true, status: "completed", ...result });
}
