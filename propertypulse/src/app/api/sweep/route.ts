import { NextRequest, NextResponse } from "next/server";
import { getAgentStatuses, runSweep } from "@/lib/orchestrate";
import { dispatchSweepWorkflow } from "@/lib/github";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const agentStatuses = await getAgentStatuses();
  return NextResponse.json({ agentStatuses });
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (process.env.VERCEL) {
    const dispatched = await dispatchSweepWorkflow();
    return NextResponse.json({ ok: dispatched, status: dispatched ? "dispatched" : "not_configured" });
  }

  const result = await runSweep("manual trigger (local)");
  return NextResponse.json({ ok: true, status: "completed", ...result });
}
