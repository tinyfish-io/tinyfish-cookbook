import { NextResponse } from "next/server";
import { getSearch, getListingsForSearch, getAgentStatuses } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const search = await getSearch(params.id);
  if (!search) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [listings, agentStatuses] = await Promise.all([getListingsForSearch(params.id), getAgentStatuses()]);
  return NextResponse.json({ search, listings, agentStatuses });
}
