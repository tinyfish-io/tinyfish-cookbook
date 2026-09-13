import { NextResponse } from "next/server";
import { draftRestockRequest } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const request = await draftRestockRequest(params.id);
    return NextResponse.json({ request });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to draft" }, { status: 500 });
  }
}
