import { NextResponse } from "next/server";
import { getServiceRequests, setServiceRequests } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const all = await getServiceRequests();
  const existing = all.find((r) => r.id === params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = all.map((r) =>
    r.id === params.id ? { ...r, stage: "submitted" as const, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r
  );
  await setServiceRequests(updated);
  return NextResponse.json({ request: updated.find((r) => r.id === params.id), note: "Service request completed. Not yet connected to a real Tasco Auto booking system." });
}
