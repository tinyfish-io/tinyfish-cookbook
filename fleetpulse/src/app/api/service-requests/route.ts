import { NextResponse } from "next/server";
import { getServiceRequests } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";

export async function GET() {
  const requests = await getServiceRequests();
  return NextResponse.json({ requests });
}
