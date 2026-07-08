import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

// Completes the request through to "submitted." Doesn't send anything to a
// real external supplier system yet — same honest boundary as FareGuard's
// booking flow — but the full draft/review/submit loop is real.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const requests = await store.getRestockRequests();
  const existing = requests.find((r) => r.id === params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = requests.map((r) =>
    r.id === params.id ? { ...r, stage: "submitted" as const, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : r
  );
  await store.setRestockRequests(updated);
  return NextResponse.json({ request: updated.find((r) => r.id === params.id), note: "Restock request completed. Not yet connected to a real supplier system." });
}
