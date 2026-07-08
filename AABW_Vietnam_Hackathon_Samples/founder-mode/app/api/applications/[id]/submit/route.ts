import { NextResponse } from "next/server";
import { submitApplication } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await submitApplication(params.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Submit failed" }, { status: 400 });
  }
}
