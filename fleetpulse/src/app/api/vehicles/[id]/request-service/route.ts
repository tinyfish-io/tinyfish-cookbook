import { NextResponse } from "next/server";
import { requestServiceManually } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const request = await requestServiceManually(params.id);
  if (!request) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  return NextResponse.json({ request });
}
