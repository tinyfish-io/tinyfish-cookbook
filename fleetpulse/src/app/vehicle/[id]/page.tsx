"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCcw, Fuel, TicketCheck, TrendingUp, Gauge, Wrench, ExternalLink } from "lucide-react";
import Link from "next/link";
import AgentStatusStrip from "@/components/AgentStatusStrip";
import { fetchJson } from "@/lib/fetchJson";
import { formatVnd } from "@/lib/format";
import { SOURCES } from "@/lib/seed";
import type { Vehicle, CostSnapshot, AgentStatus, ServiceRequest } from "@/lib/types";

const KIND_ICON = { fuel: Fuel, toll: TicketCheck, competitor: TrendingUp } as const;

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, CostSnapshot>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const running = Boolean(Object.keys(agentStatuses).length > 0 && Object.keys(agentStatuses).length < SOURCES.length);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson(`/api/vehicles/${params.id}`);
      setVehicle(data.vehicle);
      setSnapshots(data.snapshots);
      setAgentStatuses(data.agentStatuses ?? {});
      setServiceRequest(data.serviceRequest);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, [params.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, running ? 4000 : 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, running]);

  async function checkNow() {
    setTriggering(true);
    const res = await fetch(`/api/vehicles/${params.id}/sweep`, { method: "POST" });
    const data = await res.json();
    setNote(data.status === "dispatched" ? "Triggered — this can take a few minutes." : data.status === "started" ? "Checking…" : "Couldn't trigger a check right now.");
    await load();
    setTriggering(false);
    setTimeout(() => setNote(null), 6000);
  }

  async function applyForService() {
    setRequesting(true);
    await fetch(`/api/vehicles/${params.id}/request-service`, { method: "POST" });
    await load();
    setRequesting(false);
  }

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load this vehicle</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }
  if (!loaded || !vehicle) return <div className="skeleton h-96 rounded-xl" />;

  const usedKm = vehicle.currentMileageKm - vehicle.lastServiceMileageKm;
  const pct = Math.min(100, (usedKm / vehicle.serviceIntervalKm) * 100);
  const due = usedKm >= vehicle.serviceIntervalKm;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push("/")} className="text-xs text-text-secondary hover:text-accent transition-colors flex items-center gap-1.5">
          <ArrowLeft size={13} /> Back to fleet
        </button>
        <button
          onClick={checkNow}
          disabled={triggering || running}
          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-medium flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <RefreshCcw size={12} className={triggering || running ? "animate-spin" : ""} /> {running ? "Checking…" : triggering ? "Starting…" : "Check now"}
        </button>
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-2xl">{vehicle.name}</h1>
        <p className="text-sm text-text-muted mt-1 tabular capitalize">
          {vehicle.plate} · {vehicle.fuelType} · {vehicle.vehicleClass}
        </p>
        {note && <p className="text-xs text-accent mt-2">{note}</p>}
      </div>

      <AgentStatusStrip agentStatuses={agentStatuses} running={running} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {SOURCES.map((source) => {
          const snapshot = snapshots[source.id];
          const Icon = KIND_ICON[source.kind];
          return (
            <motion.div key={source.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-surface rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-accent" />
                <p className="text-xs text-text-secondary">{snapshot?.label ?? source.name}</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-medium tabular">{snapshot ? formatVnd(snapshot.valueVnd) : "No data yet"}</p>
                {snapshot?.source === "estimated" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning uppercase tracking-wide">Estimated</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="card-surface rounded-xl p-5">
        <p className="text-sm font-medium mb-3">Service status</p>
        <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
          <Gauge size={12} /> {vehicle.currentMileageKm.toLocaleString("vi-VN")} km
        </div>
        <div className="w-full h-1.5 rounded-full bg-surface-alt overflow-hidden mb-1">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: due ? "var(--danger)" : "var(--accent)" }} />
        </div>
        <p className="text-[11px] text-text-muted mb-4">
          {due ? "Past service interval" : `${(vehicle.serviceIntervalKm - usedKm).toLocaleString("vi-VN")} km to next service`}
        </p>

        {serviceRequest ? (
          <Link href={`/service/${serviceRequest.id}`} className="text-xs px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors flex items-center justify-center gap-1.5">
            <ExternalLink size={12} /> View service request ({serviceRequest.stage})
          </Link>
        ) : (
          <button
            onClick={applyForService}
            disabled={requesting}
            className="w-full text-xs px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Wrench size={12} /> {requesting ? "Requesting…" : "Apply for service"}
          </button>
        )}
      </div>
    </div>
  );
}
