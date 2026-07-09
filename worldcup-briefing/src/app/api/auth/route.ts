import { NextRequest, NextResponse } from "next/server";
import { TinyFish } from "@tiny-fish/sdk";
import { connect } from "videodb";
import { createHash } from "crypto";
import { createSessionToken } from "@/lib/session";
import { db, userKeys } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    tfApiKey?: string;
    vdbApiKey?: string;
  } | null;

  const tfApiKey = body?.tfApiKey?.trim() || "";
  const vdbApiKey = body?.vdbApiKey?.trim() || "";

  if (!tfApiKey || !vdbApiKey) {
    return NextResponse.json({ error: "Both API keys are required" }, { status: 400 });
  }

  try {
    const client = new TinyFish({ apiKey: tfApiKey, timeout: 10000, maxRetries: 0 });
    await client.search.query({ query: "test" });
  } catch {
    return NextResponse.json({ error: "TinyFish API key is invalid" }, { status: 401 });
  }

  let userId: string | undefined;
  try {
    const conn = connect(vdbApiKey);
    await conn.getCollections();
    try {
      const usage = await conn.checkUsage();
      userId = typeof usage?.user_id === "string" ? usage.user_id : undefined;
    } catch {
      try {
        const resp = await fetch("https://api.videodb.io/user", {
          headers: { "X-Access-Token": vdbApiKey },
        });
        if (resp.ok) {
          const data = await resp.json() as { user_id?: string };
          userId = typeof data?.user_id === "string" ? data.user_id : undefined;
        }
      } catch {}
    }
  } catch {
    return NextResponse.json({ error: "VideoDB API key is invalid" }, { status: 401 });
  }

  if (userId) {
    const apiKeyHash = createHash("sha256").update(vdbApiKey).digest("hex");
    await db
      .insert(userKeys)
      .values({ apiKeyHash, userId })
      .onConflictDoUpdate({ target: userKeys.apiKeyHash, set: { userId } })
      .catch(() => {});
  }

  const token = createSessionToken(tfApiKey, vdbApiKey, userId);
  return NextResponse.json({ token });
}
