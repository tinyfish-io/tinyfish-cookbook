import type { CostSource, Vehicle, ServiceFormField } from "./types";

// Same 3 real sources, kept to one link per information type. The goal
// sent to each agent is now personalized per vehicle (fuel type, vehicle
// class) rather than one shared fleet-wide query.
export const SOURCES: CostSource[] = [
  { id: "petrolimex", name: "Petrolimex", url: "https://www.petrolimex.com.vn/", kind: "fuel" },
  { id: "vetc", name: "VETC", url: "https://vetc.com.vn/", kind: "toll" },
  { id: "grab", name: "Grab", url: "https://www.grab.com/vn/en/", kind: "competitor" },
];

// One example vehicle so the homepage isn't empty on first load — deliberately
// seeded already past its service interval, guaranteeing a real service
// request to test. Add more vehicles from the homepage.
export const EXAMPLE_VEHICLE: Vehicle = {
  id: "vehicle-example",
  name: "Hyundai Porter",
  plate: "29H-123.45",
  fuelType: "diesel",
  vehicleClass: "truck",
  currentMileageKm: 45200,
  lastServiceMileageKm: 40000,
  serviceIntervalKm: 5000,
  createdAt: new Date().toISOString(),
  lastSweptAt: null,
};

export const SERVICE_FORM_FIELDS: ServiceFormField[] = [
  { id: "plate", label: "Vehicle plate", type: "text" },
  { id: "model", label: "Vehicle model", type: "text" },
  { id: "mileage", label: "Current mileage (km)", type: "number" },
  { id: "serviceType", label: "Service type requested", type: "text" },
  { id: "reason", label: "Reason / notes", type: "textarea", helper: "Why this service is needed now" },
  { id: "preferredDate", label: "Preferred appointment window", type: "text" },
];
