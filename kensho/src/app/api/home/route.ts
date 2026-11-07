import { NextResponse } from "next/server";
import { recentSearches, recentlyDrawn } from "@/server/db";
import { llmConfigured } from "@/server/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    recentSearches: recentSearches(8),
    recentlyDrawn: recentlyDrawn(6),
    status: { tinyfish: !!process.env.TINYFISH_API_KEY, llm: llmConfigured() },
  });
}
