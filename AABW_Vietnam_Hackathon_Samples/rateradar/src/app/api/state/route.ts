import { NextResponse } from "next/server";
import { getState, getApplications } from "@/lib/sweep";

// Purely read-only, always — never triggers a sweep itself, no matter how
// many times or how quickly it's called. The very first-ever sweep is
// triggered explicitly by the frontend (via the SSE stream endpoint) the
// moment it sees lastSweepAt is null, not implicitly by this route.
export const dynamic = "force-dynamic";

export async function GET() {
  const [state, applications] = await Promise.all([getState(), getApplications()]);
  return NextResponse.json({ ...state, applications });
}
