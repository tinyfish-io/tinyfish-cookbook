import { storeGet, storeSet, acquireLock, releaseLock } from "./storage";
import { SOURCES, EXAMPLE_VEHICLE } from "./seed";
import { runCostSweepForVehicle } from "./costs";
import { isServiceDue, serviceDueReason, draftServiceAnswers } from "./service";
import type { CostSnapshot, AgentStatus, ServiceRequest, Vehicle, FuelType, VehicleClass } from "./types";

// The 3 sources for one vehicle run genuinely in parallel and each wants to
// read-modify-write the SAME shared snapshots/statuses object. Without
// this, two sources finishing around the same moment can each read the
// state before the other's write lands, and one silently clobbers the
// other's result — confirmed directly: a real test run only persisted 1
// of 3 snapshots. This serializes just the "persist this result" step
// (a few ms), not the actual slow agent work, so it costs nothing real.
function createMutex() {
  let chain: Promise<unknown> = Promise.resolve();
  return function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = chain.then(fn, fn);
    chain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}
const persistMutex = createMutex();

const VEHICLES_KEY = "vehicles";
const SNAPSHOTS_KEY = "cost-snapshots"; // Record<`${vehicleId}__${sourceId}`, CostSnapshot>
const STATUS_KEY = "agent-statuses"; // Record<`${vehicleId}__${sourceId}`, AgentStatus>
const REQUESTS_KEY = "service-requests";
const LOCK_KEY = "sweep-lock";
const LOCK_TTL_SECONDS = 8 * 60;

export async function getVehicles(): Promise<Vehicle[]> {
  const data = await storeGet<Vehicle[]>(VEHICLES_KEY);
  if (data) return data;
  await storeSet(VEHICLES_KEY, [EXAMPLE_VEHICLE]);
  return [EXAMPLE_VEHICLE];
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const all = await getVehicles();
  return all.find((v) => v.id === id) ?? null;
}

export async function addVehicle(input: {
  name: string;
  plate: string;
  fuelType: FuelType;
  vehicleClass: VehicleClass;
  currentMileageKm: number;
  lastServiceMileageKm: number;
  serviceIntervalKm: number;
}): Promise<Vehicle> {
  const all = await getVehicles();
  const vehicle: Vehicle = {
    id: `vehicle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    createdAt: new Date().toISOString(),
    lastSweptAt: null,
  };
  await storeSet(VEHICLES_KEY, [vehicle, ...all]);
  return vehicle;
}

export async function getAllSnapshots(): Promise<Record<string, CostSnapshot>> {
  return (await storeGet<Record<string, CostSnapshot>>(SNAPSHOTS_KEY)) ?? {};
}
export async function getSnapshotsForVehicle(vehicleId: string): Promise<Record<string, CostSnapshot>> {
  const all = await getAllSnapshots();
  const filtered: Record<string, CostSnapshot> = {};
  for (const [key, snap] of Object.entries(all)) {
    if (key.startsWith(`${vehicleId}__`)) filtered[snap.sourceId] = snap;
  }
  return filtered;
}

export async function getAllAgentStatuses(): Promise<Record<string, AgentStatus>> {
  return (await storeGet<Record<string, AgentStatus>>(STATUS_KEY)) ?? {};
}
export async function getAgentStatusesForVehicle(vehicleId: string): Promise<Record<string, AgentStatus>> {
  const all = await getAllAgentStatuses();
  const filtered: Record<string, AgentStatus> = {};
  for (const [key, status] of Object.entries(all)) {
    if (key.startsWith(`${vehicleId}__`)) filtered[status.sourceId] = status;
  }
  return filtered;
}

export async function getServiceRequests(): Promise<ServiceRequest[]> {
  return (await storeGet<ServiceRequest[]>(REQUESTS_KEY)) ?? [];
}
export async function getServiceRequest(id: string): Promise<ServiceRequest | null> {
  const all = await getServiceRequests();
  return all.find((r) => r.id === id) ?? null;
}
export async function setServiceRequests(data: ServiceRequest[]): Promise<void> {
  await storeSet(REQUESTS_KEY, data);
}
export async function getServiceRequestForVehicle(vehicleId: string): Promise<ServiceRequest | null> {
  const all = await getServiceRequests();
  const open = all.filter((r) => r.vehicleId === vehicleId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return open[0] ?? null;
}

async function draftAndCreateRequest(vehicle: Vehicle, reason: string): Promise<void> {
  const existing = await getServiceRequests();
  const request: ServiceRequest = {
    id: `service-${vehicle.id}-${Date.now()}`,
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    stage: "drafting",
    reason,
    answers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submittedAt: null,
  };
  await setServiceRequests([request, ...existing]);

  const answers = await draftServiceAnswers(vehicle, reason);
  const withDraft = (await getServiceRequests()).map((r) =>
    r.id === request.id ? { ...r, stage: "ready" as const, answers, updatedAt: new Date().toISOString() } : r
  );
  await setServiceRequests(withDraft);
  console.log(`[sweep] auto-drafted service request for ${vehicle.plate}`);
}

// Sweeps ONE vehicle's 3 personalized sources, persisting progressively —
// used both by the "add vehicle" bootstrap and the scheduled daily cron
// (which loops this over every vehicle).
async function sweepVehicle(vehicle: Vehicle): Promise<void> {
  await runCostSweepForVehicle(SOURCES, vehicle, async (source, snapshot, status) => {
    await persistMutex(async () => {
      const current = await getAllSnapshots();
      current[`${vehicle.id}__${source.id}`] = snapshot;
      await storeSet(SNAPSHOTS_KEY, current);
      const currentStatuses = await getAllAgentStatuses();
      currentStatuses[`${vehicle.id}__${source.id}`] = status;
      await storeSet(STATUS_KEY, currentStatuses);
    });
    console.log(`[sweep] ${source.name} done for ${vehicle.name}`);
  });

  const all = await getVehicles();
  await storeSet(VEHICLES_KEY, all.map((v) => (v.id === vehicle.id ? { ...v, lastSweptAt: new Date().toISOString() } : v)));

  if (isServiceDue(vehicle)) {
    const existingRequests = await getServiceRequests();
    const hasOpenRequest = existingRequests.some((r) => r.vehicleId === vehicle.id && r.stage !== "submitted");
    if (!hasOpenRequest) {
      await draftAndCreateRequest(vehicle, serviceDueReason(vehicle));
    }
  }
}

export async function runSweepAndSave(reason: string, forceVehicleIds?: string[]): Promise<{ vehiclesSwept: number }> {
  if (!(await acquireLock(LOCK_KEY, LOCK_TTL_SECONDS))) {
    console.log(`[sweep] a sweep is already in progress — skipping duplicate trigger (reason: ${reason})`);
    return { vehiclesSwept: 0 };
  }
  try {
    console.log(`[sweep] starting — reason: ${reason}`);
    const all = await getVehicles();
    const targets = forceVehicleIds ? all.filter((v) => forceVehicleIds.includes(v.id)) : all;
    for (const vehicle of targets) {
      await sweepVehicle(vehicle);
    }
    console.log(`[sweep] complete — ${targets.length} vehicle(s) swept`);
    return { vehiclesSwept: targets.length };
  } finally {
    await releaseLock(LOCK_KEY);
  }
}

// Manual "Apply for service" — creates and drafts a request right away,
// regardless of whether the vehicle is actually due yet.
export async function requestServiceManually(vehicleId: string): Promise<ServiceRequest | null> {
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) return null;
  const reason = isServiceDue(vehicle) ? serviceDueReason(vehicle) : `Manually requested for ${vehicle.plate} at ${vehicle.currentMileageKm.toLocaleString("vi-VN")} km.`;
  await draftAndCreateRequest(vehicle, reason);
  return getServiceRequestForVehicle(vehicleId);
}

let bootstrapChecked = false;
export function bootstrapLocalDevIfNeeded() {
  if (process.env.VERCEL) return;
  if (!process.env.TINYFISH_API_KEY) return;
  if (bootstrapChecked) return;
  bootstrapChecked = true;

  getVehicles().then((all) => {
    const neverSwept = all.filter((v) => v.lastSweptAt === null);
    if (neverSwept.length === 0) return;
    console.log("[bootstrap] first run detected, sweeping never-checked vehicles in the background...");
    runSweepAndSave("local-dev-bootstrap (first ever run)", neverSwept.map((v) => v.id))
      .then(() => console.log("[bootstrap] background sweep complete"))
      .catch((err) => console.error("[bootstrap] background sweep failed:", err));
  });
}
