export type FuelType = "petrol" | "diesel" | "electric";
export type VehicleClass = "car" | "truck";

export interface Vehicle {
  id: string;
  name: string; // model name, e.g. "Hyundai Porter"
  plate: string;
  fuelType: FuelType;
  vehicleClass: VehicleClass;
  currentMileageKm: number;
  lastServiceMileageKm: number;
  serviceIntervalKm: number;
  createdAt: string;
  lastSweptAt: string | null;
}

export interface CostSource {
  id: string;
  name: string;
  url: string;
  kind: "fuel" | "toll" | "competitor";
}

export interface CostSnapshot {
  vehicleId: string;
  sourceId: string;
  label: string;
  valueVnd: number;
  checkedAt: string;
  source: "real" | "estimated";
}

export interface AgentStatus {
  vehicleId: string;
  sourceId: string;
  status: "done" | "error";
  lastSyncedAt: string;
}

export type ServiceStage = "flagged" | "drafting" | "ready" | "submitted";

export interface ServiceAnswer {
  fieldId: string;
  label: string;
  draft: string;
  edited: boolean;
}

export interface ServiceRequest {
  id: string;
  vehicleId: string;
  vehicleName: string;
  stage: ServiceStage;
  reason: string;
  answers: ServiceAnswer[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface ServiceFormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number";
  helper?: string;
}
