"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Truck, Car, Fuel, Clock } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { relativeTime } from "@/lib/format";

const VehicleCard = forwardRef<HTMLAnchorElement, { vehicle: Vehicle }>(function VehicleCard({ vehicle }, ref) {
  const Icon = vehicle.vehicleClass === "truck" ? Truck : Car;
  const usedKm = vehicle.currentMileageKm - vehicle.lastServiceMileageKm;
  const due = usedKm >= vehicle.serviceIntervalKm;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link ref={ref} href={`/vehicle/${vehicle.id}`} className="card-surface rounded-xl p-5 block">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center">
            <Icon size={16} className="text-accent" />
          </div>
          {due && <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger/10 text-danger uppercase tracking-wide">Service due</span>}
        </div>
        <p className="text-sm font-medium mb-1">{vehicle.name}</p>
        <p className="text-xs text-text-muted mb-3 tabular">{vehicle.plate}</p>
        <p className="text-[11px] text-text-secondary flex items-center gap-1 mb-2 capitalize">
          <Fuel size={11} /> {vehicle.fuelType} · {vehicle.vehicleClass}
        </p>
        <p className="text-[11px] text-text-muted flex items-center gap-1">
          <Clock size={11} /> {vehicle.lastSweptAt ? `Checked ${relativeTime(vehicle.lastSweptAt)}` : "Not checked yet"}
        </p>
      </Link>
    </motion.div>
  );
});

export default VehicleCard;
