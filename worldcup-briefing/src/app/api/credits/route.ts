import { NextRequest, NextResponse } from "next/server";
import { connect } from "videodb";
import { resolveSessionToken } from "@/lib/session";
import { logger } from "@/lib/logger";

const LOW_CREDIT_THRESHOLD = 5;

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-session-token");
  if (!token) {
    return NextResponse.json({ remaining: null, low: false });
  }

  const session = resolveSessionToken(token);
  if (!session?.vdbApiKey) {
    return NextResponse.json({ remaining: null, low: false });
  }

  try {
    const conn = connect(session.vdbApiKey);
    const usage = await conn.checkUsage();

    const remaining = typeof usage?.creditBalance === "number" ? usage.creditBalance : null;

    if (remaining === null) {
      return NextResponse.json({ remaining: null, low: false });
    }

    return NextResponse.json({
      remaining,
      low: remaining < LOW_CREDIT_THRESHOLD,
    });
  } catch (error) {
    logger.error({ err: error }, "Credits check failed");
    return NextResponse.json({ remaining: null, low: false });
  }
}
