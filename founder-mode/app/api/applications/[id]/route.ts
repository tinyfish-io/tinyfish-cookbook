import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const applications = await store.getApplications();
  const application = applications.find((a) => a.id === params.id);
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ application });
}

// Lets the founder edit a drafted answer before submitting.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const questions = body.questions;
  if (!Array.isArray(questions)) {
    return NextResponse.json({ error: "questions array required" }, { status: 400 });
  }

  const applications = await store.getApplications();
  const existing = applications.find((a) => a.id === params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = applications.map((a) =>
    a.id === params.id ? { ...a, questions, updatedAt: new Date().toISOString() } : a
  );
  await store.setApplications(updated);
  return NextResponse.json({ application: updated.find((a) => a.id === params.id) });
}

// Removes an application from the pipeline entirely — meant for cleaning up
// after submission so the board doesn't accumulate finished applications
// forever. Doesn't touch the underlying program (still shows in Discover).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const applications = await store.getApplications();
  const existing = applications.find((a) => a.id === params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = applications.filter((a) => a.id !== params.id);
  await store.setApplications(updated);
  return NextResponse.json({ ok: true });
}
