import { NextResponse, type NextRequest } from "next/server";
import { discover, type DiscoverEvent } from "@/server/discovery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ error: "Enter a research topic to search." }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "That topic is too long — try a shorter phrase." }, { status: 400 });
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  // ?stream=1 → NDJSON: progress events while TinyFish works, then {type:"result"} or {type:"error"}.
  if (req.nextUrl.searchParams.get("stream") === "1") {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (o: DiscoverEvent | { type: "result"; data: unknown } | { type: "error"; error: string }) =>
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        try {
          const data = await discover(q, { fresh, onEvent: send });
          send({ type: "result", data });
        } catch (e) {
          send({ type: "error", error: `TinyFish could not complete the search: ${(e as Error).message}` });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  }

  try {
    return NextResponse.json(await discover(q, { fresh }));
  } catch (e) {
    return NextResponse.json({ error: `TinyFish could not complete the search: ${(e as Error).message}` }, { status: 502 });
  }
}
