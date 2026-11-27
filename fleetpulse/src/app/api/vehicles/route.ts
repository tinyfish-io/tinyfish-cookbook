import { NextRequest, NextResponse } from "next/server";
import { getVehicles, addVehicle, runSweepAndSave, bootstrapLocalDevIfNeeded } from "@/lib/orchestrate";
import { dispatchSweepWorkflow } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  bootstrapLocalDevIfNeeded();
  const vehicles = await getVehicles();
  return NextResponse.json({ vehicles });
}

// Adds a vehicle and sweeps it once immediately — on Vercel via GitHub
// Actions dispatch, locally inline in the background.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const plate = String(body.plate ?? "").trim();
  const fuelType = ["petrol", "diesel", "electric"].includes(body.fuelType) ? body.fuelType : "petrol";
  const vehicleClass = body.vehicleClass === "truck" ? "truck" : "car";
  const currentMileageKm = Number(body.currentMileageKm) || 0;
  const lastServiceMileageKm = Number(body.lastServiceMileageKm) || 0;
  const serviceIntervalKm = Number(body.serviceIntervalKm) || 5000;

  if (!name || !plate) {
    return NextResponse.json({ error: "Model name and plate are required" }, { status: 400 });
  }

  const vehicle = await addVehicle({ name, plate, fuelType, vehicleClass, currentMileageKm, lastServiceMileageKm, serviceIntervalKm });

  if (process.env.VERCEL) {
    dispatchSweepWorkflow().catch((err) => console.error("[vehicles] dispatch failed:", err));
  } else {
    runSweepAndSave(`new vehicle added: ${name}`, [vehicle.id]).catch((err) => console.error("[vehicles] inline sweep failed:", err));
  }

  return NextResponse.json({ vehicle });
}
