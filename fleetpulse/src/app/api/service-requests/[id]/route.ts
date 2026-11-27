import { NextResponse } from "next/server";
import { getServiceRequest, getServiceRequests, setServiceRequests } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const request = await getServiceRequest(params.id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ request });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const answers = body.answers;
  if (!Array.isArray(answers)) return NextResponse.json({ error: "answers array required" }, { status: 400 });
  const all = await getServiceRequests();
  const existing = all.find((r) => r.id === params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = all.map((r) => (r.id === params.id ? { ...r, answers, updatedAt: new Date().toISOString() } : r));
  await setServiceRequests(updated);
  return NextResponse.json({ request: updated.find((r) => r.id === params.id) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const all = await getServiceRequests();
  const existing = all.find((r) => r.id === params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await setServiceRequests(all.filter((r) => r.id !== params.id));
  return NextResponse.json({ ok: true });
}
