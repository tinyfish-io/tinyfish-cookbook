import { NextResponse } from "next/server";
import { runSweepAndSave } from "@/lib/orchestrate";
import { dispatchSweepWorkflow } from "@/lib/github";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Force-sweeps just this one vehicle — the per-vehicle "Sync now."
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (process.env.VERCEL) {
    const dispatched = await dispatchSweepWorkflow();
    return NextResponse.json({ ok: dispatched, status: dispatched ? "dispatched" : "not_configured" });
  }
  runSweepAndSave(`manual force-sweep for ${params.id}`, [params.id]).catch((err) => console.error("[sweep] force-sweep failed:", err));
  return NextResponse.json({ ok: true, status: "started" });
}
