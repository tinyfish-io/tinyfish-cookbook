"use client";

import { forwardRef, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import type { FuelType, VehicleClass } from "@/lib/types";

const VehicleForm = forwardRef<HTMLButtonElement, { onAdded: () => void }>(function VehicleForm({ onAdded }, addButtonRef) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>("diesel");
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>("truck");
  const [currentMileageKm, setCurrentMileageKm] = useState(0);
  const [lastServiceMileageKm, setLastServiceMileageKm] = useState(0);
  const [serviceIntervalKm, setServiceIntervalKm] = useState(5000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !plate.trim()) {
      setError("Model name and plate are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, plate, fuelType, vehicleClass, currentMileageKm, lastServiceMileageKm, serviceIntervalKm }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that vehicle");
      return;
    }
    setName("");
    setPlate("");
    setCurrentMileageKm(0);
    setLastServiceMileageKm(0);
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        ref={addButtonRef}
        onClick={() => setOpen(true)}
        className="text-xs px-4 py-2.5 rounded-lg bg-accent text-white font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
      >
        <Plus size={14} /> Add a vehicle
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-surface rounded-xl p-5 mb-6">
      <p className="text-sm font-medium mb-3">Add a vehicle</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Model name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hyundai Porter" className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Plate</label>
          <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. 29H-123.45" className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Fuel type</label>
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)} className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30">
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="electric">Electric</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Vehicle class</label>
          <select value={vehicleClass} onChange={(e) => setVehicleClass(e.target.value as VehicleClass)} className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30">
            <option value="car">Car</option>
            <option value="truck">Truck / van</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Current mileage (km)</label>
          <input type="number" value={currentMileageKm} onChange={(e) => setCurrentMileageKm(Number(e.target.value))} className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Mileage at last service (km)</label>
          <input type="number" value={lastServiceMileageKm} onChange={(e) => setLastServiceMileageKm(Number(e.target.value))} className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Service interval (km)</label>
          <input type="number" value={serviceIntervalKm} onChange={(e) => setServiceIntervalKm(Number(e.target.value))} className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {submitting ? "Adding…" : "Start tracking"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text-primary transition-colors">
          Cancel
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
      <p className="text-[11px] text-text-muted mt-3">Checks costs immediately once, personalized to this vehicle's fuel type and class.</p>
    </form>
  );
});

export default VehicleForm;
