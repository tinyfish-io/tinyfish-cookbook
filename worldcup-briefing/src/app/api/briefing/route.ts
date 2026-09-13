import { NextRequest, NextResponse } from "next/server";
import { buildDemoBriefing, demoVideos, searchDemoVideos, type VideoCandidate } from "@/lib/demo-data";
import { buildLiveOrFallbackBriefing, discoverVideo } from "@/lib/video-pipeline";
import { resolveSessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = resolveSessionToken(request.headers.get("x-session-token") || "");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { topic?: string; video?: VideoCandidate; live?: boolean }
    | null;

  const topic = body?.topic?.trim() || "World Cup match briefing";

  if (body?.live) {
    const selectedVideo = body.video || (await discoverVideo(topic));
    return NextResponse.json(await buildLiveOrFallbackBriefing(topic, selectedVideo));
  }

  const selectedVideo = body?.video || searchDemoVideos(topic)[0] || demoVideos[0];
  return NextResponse.json(buildDemoBriefing(topic, selectedVideo));
}
