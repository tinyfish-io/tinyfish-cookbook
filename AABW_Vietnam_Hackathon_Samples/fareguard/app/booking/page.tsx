"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarClock } from "lucide-react";
import { SITES } from "@/lib/seed";
import type { BookingRequest, RouteCode, RouteInfo } from "@/lib/types";
import { formatVnd, formatDate } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";

const STATUS_LABEL: Record<BookingRequest["status"], string> = {
  waiting: "Waiting for threshold",
  booked: "Flight booked",
};

export default function BookingPage() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    passengerName: "",
    routeCode: "" as RouteCode,
    travelDate: "",
    thresholdVnd: "",
    preferredSiteId: "vietjet",
  });

  const load = useCallback(async () => {
    try {
      const [data, routesData] = await Promise.all([fetchJson("/api/booking-requests"), fetchJson("/api/routes")]);
      setRequests(data.requests);
      setRoutes(routesData.routes);
      setForm((f) => (f.routeCode ? f : { ...f, routeCode: routesData.routes[0]?.code ?? "" }));
      setLoadError(null);
    } catch (err) {
      console.error("Failed to load booking data:", err);
      setLoadError(err instanceof Error ? err.message : "Unknown error loading data");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.passengerName || !form.travelDate || !form.thresholdVnd) return;
    setSubmitting(true);
    await fetch("/api/booking-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ passengerName: "", routeCode: routes[0]?.code ?? "", travelDate: "", thresholdVnd: "", preferredSiteId: "vietjet" });
    await load();
    setSubmitting(false);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Booking requests</h1>
        <p className="text-sm text-text-muted mt-1">Set a threshold — it books automatically once the fare drops to it.</p>
      </div>

      {loadError && (
        <div className="card-surface rounded-xl p-4 mb-6 border-danger/30">
          <p className="text-sm font-medium text-danger mb-1">Couldn't load booking data</p>
          <p className="text-xs text-text-muted break-words">{loadError}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="card-surface rounded-xl p-5">
          <p className="font-medium text-sm mb-1">New booking request</p>
          <p className="text-xs text-text-muted mb-4">
            Threshold checks only happen as part of a scheduled sweep (every 8 hours) — adding a request here never
            fires a search itself. When the fare drops to or below the threshold, it shows as booked here. This is a
            demo status only — no real booking or payment happens yet.
          </p>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">Passenger name</label>
              <input
                value={form.passengerName}
                onChange={(e) => setForm({ ...form, passengerName: e.target.value })}
                placeholder="Nguyen Van A"
                className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Route</label>
              <select
                value={form.routeCode}
                onChange={(e) => setForm({ ...form, routeCode: e.target.value as RouteCode })}
                className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow"
              >
                {routes.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.from} → {r.to}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Travel date</label>
              <input
                type="date"
                value={form.travelDate}
                onChange={(e) => setForm({ ...form, travelDate: e.target.value })}
                className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Threshold price (VND)</label>
              <input
                type="number"
                value={form.thresholdVnd}
                onChange={(e) => setForm({ ...form, thresholdVnd: e.target.value })}
                placeholder="1200000"
                className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-text-secondary block mb-1">Preferred site</label>
              <div className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm flex items-center justify-between">
                <span>Vietjet Air</span>
                <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded">auto-fill supported</span>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Vietjet is the only site wired for form auto-fill right now — other sites are tracking-only.
              </p>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-md bg-accent text-bg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {submitting ? "Saving…" : "Add booking request"}
              </button>
            </div>
          </form>
        </div>

        <div className="card-surface rounded-xl p-5">
          <p className="font-medium text-sm mb-3">Pending requests</p>
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <CalendarClock size={22} strokeWidth={1.5} className="text-text-muted" />
              <p className="text-sm text-text-muted">No booking requests yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary text-xs">
                  <th className="font-normal pb-2">Passenger</th>
                  <th className="font-normal pb-2">Route</th>
                  <th className="font-normal pb-2">Travel date</th>
                  <th className="font-normal pb-2">Threshold</th>
                  <th className="font-normal pb-2">Site</th>
                  <th className="font-normal pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-t border-border hover:bg-surface-alt/50 transition-colors">
                    <td className="py-2.5">{req.passengerName}</td>
                    <td className="py-2.5 text-text-secondary">{req.routeCode}</td>
                    <td className="py-2.5 text-text-secondary">{formatDate(req.travelDate)}</td>
                    <td className="py-2.5 tabular">{formatVnd(req.thresholdVnd)}</td>
                    <td className="py-2.5 text-text-secondary">
                      {SITES.find((s) => s.id === req.preferredSiteId)?.name}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          req.status === "booked" ? "bg-success/10 text-success" : "bg-surface-alt text-text-secondary"
                        }`}
                      >
                        {STATUS_LABEL[req.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
