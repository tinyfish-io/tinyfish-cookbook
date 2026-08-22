import { computeLeadTime } from "@/lib/leadtime";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let ticker: string;
  try {
    const body = (await request.json()) as { ticker?: string };
    ticker = (body.ticker ?? "").trim().toUpperCase();
    if (!ticker) throw new Error("empty");
  } catch {
    return Response.json({ error: "body must be {ticker}" }, { status: 400 });
  }

  try {
    const result = await computeLeadTime(ticker);
    return Response.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`lead-time api: ${ticker} failed because ${message}`);
    return Response.json({ ok: false, reason: message }, { status: 502 });
  }
}
