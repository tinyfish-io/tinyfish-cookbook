import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { BookingRequest } from "@/lib/types";

// Never statically pre-render this at build time — it depends on live
// Redis/env state that may not be ready during the Vercel build step,
// and should always reflect the current request anyway.
export const dynamic = "force-dynamic";

export async function GET() {
  const requests = await store.getBookingRequests();
  return NextResponse.json({ requests });
}

// Note: this route only ever reads/writes the booking request list. It
// never calls runAgentSweep / runSweepAndMaybeAnalyze / checkBookingThresholds
// — adding a booking request does NOT trigger a sweep. Thresholds are only
// ever checked as part of the regular scheduled sweep (GitHub Actions every
// 4 hours, or the local-dev bootstrap/manual button), never on creation.
export async function POST(req: Request) {
  const body = await req.json();
  const { passengerName, routeCode, travelDate, thresholdVnd, preferredSiteId } = body;

  if (!passengerName || !routeCode || !travelDate || !thresholdVnd || !preferredSiteId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const newRequest: BookingRequest = {
    id: crypto.randomUUID(),
    passengerName,
    routeCode,
    travelDate,
    thresholdVnd: Number(thresholdVnd),
    preferredSiteId,
    status: "waiting",
    createdAt: new Date().toISOString(),
  };

  const existing = await store.getBookingRequests();
  await store.setBookingRequests([newRequest, ...existing]);

  return NextResponse.json({ request: newRequest });
}
