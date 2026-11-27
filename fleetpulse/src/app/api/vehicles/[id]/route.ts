import { NextResponse } from "next/server";
import { getVehicle, getSnapshotsForVehicle, getAgentStatusesForVehicle, getServiceRequestForVehicle } from "@/lib/orchestrate";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const vehicle = await getVehicle(params.id);
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [snapshots, agentStatuses, serviceRequest] = await Promise.all([
    getSnapshotsForVehicle(params.id),
    getAgentStatusesForVehicle(params.id),
    getServiceRequestForVehicle(params.id),
  ]);
  return NextResponse.json({ vehicle, snapshots, agentStatuses, serviceRequest });
}
