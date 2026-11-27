import { NextResponse } from "next/server";
import { recentSearches, recentlyDrawn, storageBackend } from "@/server/db";
import { llmConfigured } from "@/server/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    recentSearches: await recentSearches(8),
    recentlyDrawn: await recentlyDrawn(6),
    status: { tinyfish: !!process.env.TINYFISH_API_KEY, llm: llmConfigured(), storage: storageBackend },
  });
}
