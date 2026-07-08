import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { startApplication } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";

export async function GET() {
  const applications = await store.getApplications();
  return NextResponse.json({ applications });
}

// Called when a program card is dropped into the pipeline. Creates the
// application and kicks off extraction + drafting in the background —
// returns immediately with the application in "extracting" stage.
export async function POST(req: Request) {
  const body = await req.json();
  const programId = String(body.programId ?? "");
  if (!programId) {
    return NextResponse.json({ error: "programId is required" }, { status: 400 });
  }
  try {
    const application = await startApplication(programId);
    return NextResponse.json({ application });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start application" }, { status: 400 });
  }
}
