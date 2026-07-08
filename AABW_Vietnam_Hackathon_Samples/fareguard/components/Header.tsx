"use client";

import { useEffect, useState } from "react";
import { Search, Bell, User } from "lucide-react";

export default function Header() {
  const [status, setStatus] = useState<"checking" | "synced" | "waiting" | "error">("checking");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const [trackRes, bookingRes] = await Promise.all([fetch("/api/track"), fetch("/api/booking-requests")]);
        if (!trackRes.ok || !bookingRes.ok) throw new Error("API request failed");
        const track = await trackRes.json();
        const booking = await bookingRes.json();
        if (cancelled) return;
        setStatus(track.meta?.lastSweepAt ? "synced" : "waiting");
        setPendingCount(booking.requests.filter((r: any) => r.status === "waiting").length);
      } catch (err) {
        console.error("Header status check failed:", err);
        if (!cancelled) setStatus("error");
      }
    }
    check();
    const id = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const label =
    status === "checking"
      ? "Checking…"
      : status === "synced"
        ? "All systems synced"
        : status === "waiting"
          ? "Awaiting first sync"
          : "Connection error";

  return (
    <header className="hidden md:flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-surface">
      <div className="relative w-full max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          placeholder="Search routes, sites, bookings…"
          className="w-full bg-surface-alt border border-border rounded-md pl-9 pr-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow"
        />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
            status === "synced"
              ? "border-success/30 bg-success/10 text-success"
              : status === "error"
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-border text-text-muted"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "synced" ? "bg-success" : status === "error" ? "bg-danger" : "bg-text-muted"
            }`}
          />
          {label}
        </div>
        <button className="relative text-text-secondary hover:text-text-primary transition-colors">
          <Bell size={17} />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-warning text-[9px] text-white flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white">
          <User size={14} />
        </div>
      </div>
    </header>
  );
}
