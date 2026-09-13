import { NextRequest, NextResponse } from "next/server";
import { TinyFish } from "@tiny-fish/sdk";
import { connect } from "videodb";
import { resolveSessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = resolveSessionToken(request.headers.get("x-session-token") || "");
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    tfApiKey?: string;
    vdbApiKey?: string;
  } | null;

  const tfApiKey = body?.tfApiKey || "";
  const vdbApiKey = body?.vdbApiKey || "";

  let tfValid = false;
  let vdbValid = false;

  if (tfApiKey) {
    try {
      const client = new TinyFish({ apiKey: tfApiKey, timeout: 10000, maxRetries: 0 });
      await client.search.query({ query: "test" });
      tfValid = true;
    } catch {
      tfValid = false;
    }
  }

  if (vdbApiKey) {
    try {
      const conn = connect(vdbApiKey);
      await conn.getCollections();
      vdbValid = true;
    } catch {
      vdbValid = false;
    }
  }

  return NextResponse.json({ tfValid, vdbValid });
}
