"use client";

import { useEffect, useState } from "react";
import { Search, Bell, User } from "lucide-react";

export default function Header() {
  const [status, setStatus] = useState<"checking" | "live" | "waiting" | "error">("checking");
  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const [discoverRes, appsRes] = await Promise.all([fetch("/api/discover"), fetch("/api/applications")]);
        if (!discoverRes.ok || !appsRes.ok) throw new Error("status check failed");
        const discover = await discoverRes.json();
        const apps = await appsRes.json();
        if (cancelled) return;
        setStatus(discover.meta?.lastDiscoveryAt ? "live" : "waiting");
        setReadyCount(apps.applications.filter((a: any) => a.stage === "ready").length);
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
    status === "checking" ? "Checking…" : status === "live" ? "Agents live" : status === "waiting" ? "Awaiting first sync" : "Connection error";

  return (
    <header className="hidden md:flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-surface">
      <div className="relative w-full max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          placeholder="Search applications, programs, questions…"
          className="w-full bg-surface-alt border border-border rounded-md pl-9 pr-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow"
        />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
            status === "live" ? "border-success/30 bg-success/10 text-success" : status === "error" ? "border-danger/30 bg-danger/10 text-danger" : "border-border text-text-muted"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status === "live" ? "bg-success" : status === "error" ? "bg-danger" : "bg-text-muted"}`} />
          {label}
        </div>
        <button className="relative text-text-secondary hover:text-text-primary transition-colors">
          <Bell size={17} />
          {readyCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent text-[9px] text-white flex items-center justify-center">
              {readyCount}
            </span>
          )}
        </button>
        <div className="w-7 h-7 rounded-full bg-accent-dark flex items-center justify-center text-white">
          <User size={14} />
        </div>
      </div>
    </header>
  );
}
