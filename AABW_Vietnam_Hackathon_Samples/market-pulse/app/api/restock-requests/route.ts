import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const requests = await store.getRestockRequests();
  return NextResponse.json({ requests });
}
