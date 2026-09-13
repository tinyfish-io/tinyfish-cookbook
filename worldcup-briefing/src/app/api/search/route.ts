import { NextRequest, NextResponse } from "next/server";
import { searchWorldCupVideos } from "@/lib/video-pipeline";
import { resolveSessionToken } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = resolveSessionToken(request.headers.get("x-session-token") || "");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { query?: string } | null;
  const query = body?.query?.trim() || "USA vs Paraguay World Cup highlights";

  return NextResponse.json(await searchWorldCupVideos(query, session.tfApiKey));
}
