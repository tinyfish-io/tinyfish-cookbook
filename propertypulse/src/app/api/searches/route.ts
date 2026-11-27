import { NextRequest, NextResponse } from "next/server";
import { getSearches, addSearch, runSweep, bootstrapLocalDevIfNeeded } from "@/lib/orchestrate";
import { dispatchSweepWorkflow } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  bootstrapLocalDevIfNeeded();
  const searches = await getSearches();
  return NextResponse.json({ searches });
}

// Adds a new tracked search and sweeps it once immediately — on Vercel via
// GitHub Actions dispatch (no execution time limit there), locally by
// running inline in the background.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const area = String(body.area ?? "").trim();
  const propertyType = body.propertyType === "house" ? "house" : "apartment";
  const intent = body.intent === "sale" ? "sale" : "rent";
  const clientName = body.clientName ? String(body.clientName).trim() : null;

  if (!area) {
    return NextResponse.json({ error: "Area is required" }, { status: 400 });
  }

  const search = await addSearch({ area, propertyType, intent, clientName });

  if (process.env.VERCEL) {
    dispatchSweepWorkflow().catch((err) => console.error("[searches] dispatch failed:", err));
  } else {
    runSweep(`new search added: ${area}`, [search.id]).catch((err) => console.error("[searches] inline sweep failed:", err));
  }

  return NextResponse.json({ search });
}
