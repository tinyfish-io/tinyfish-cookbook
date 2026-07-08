import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const requests = await store.getRestockRequests();
  const request = requests.find((r) => r.id === params.id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ request });
}

// Lets the user edit a drafted answer before submitting.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const answers = body.answers;
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "answers array required" }, { status: 400 });
  }
  const requests = await store.getRestockRequests();
  const existing = requests.find((r) => r.id === params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = requests.map((r) => (r.id === params.id ? { ...r, answers, updatedAt: new Date().toISOString() } : r));
  await store.setRestockRequests(updated);
  return NextResponse.json({ request: updated.find((r) => r.id === params.id) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const requests = await store.getRestockRequests();
  const existing = requests.find((r) => r.id === params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await store.setRestockRequests(requests.filter((r) => r.id !== params.id));
  return NextResponse.json({ ok: true });
}
