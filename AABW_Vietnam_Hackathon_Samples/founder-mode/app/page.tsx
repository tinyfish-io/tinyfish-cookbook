"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCcw } from "lucide-react";
import KpiCard from "@/components/KpiCard";
import DiscoveryFeed from "@/components/DiscoveryFeed";
import PipelineBoard from "@/components/PipelineBoard";
import Countdown from "@/components/Countdown";
import AgentStatusStrip from "@/components/AgentStatusStrip";
import type { Program, Application, ScheduleMeta, AgentStatus } from "@/lib/types";
import { fetchJson } from "@/lib/fetchJson";
import { getNextScheduledRun } from "@/lib/date";

export default function DashboardPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [meta, setMeta] = useState<ScheduleMeta | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [magnetActive, setMagnetActive] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [programsData, appsData, discoverData] = await Promise.all([
        fetchJson("/api/programs"),
        fetchJson("/api/applications"),
        fetchJson("/api/discover"),
      ]);
      setPrograms(programsData.programs);
      setApplications(appsData.applications);
      setMeta(discoverData.meta);
      setAgentStatuses(discoverData.agentStatuses ?? {});
      setLoadError(null);
      setLoaded(true);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      setLoadError(err instanceof Error ? err.message : "Unknown error");
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const id = setInterval(loadAll, 8000);
    return () => clearInterval(id);
  }, [loadAll]);

  async function runDiscoveryNow() {
    setRunning(true);
    setNote(null);
    const res = await fetch("/api/discover", { method: "POST" });
    const data = await res.json();
    if (data.status === "dispatched") setNote("Triggered the GitHub Actions sweep — new programs will appear in a few minutes.");
    else if (data.status === "already_triggered") setNote("Already running — give it a moment.");
    else setNote(`Swept ${data.sitesSwept ?? "?"} sources, found ${data.newCount ?? 0} new programs.`);
    await loadAll();
    setRunning(false);
  }

  async function handleDropProgram(programId: string) {
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programId }),
    });
    await loadAll();
  }

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load the dashboard</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-40" />
      </div>
    );
  }

  const appliedProgramIds = new Set(applications.map((a) => a.programId));
  const readyCount = applications.filter((a) => a.stage === "ready").length;
  const submittedCount = applications.filter((a) => a.stage === "submitted").length;
  const urgentDeadlines = programs.filter((p) => {
    if (!p.deadline) return false;
    const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 7;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-text-muted mb-1">WORKSPACE</p>
          <h1 className="text-2xl font-medium">Good to see you.</h1>
          <p className="text-sm text-text-muted mt-1">
            {programs.filter((p) => p.source === "real").length} real programs tracked · {applications.length} applications in the pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-text-muted">
            Next sweep (11:00 Vietnam time): <Countdown targetIso={getNextScheduledRun(11)} />
          </p>
          <button
            onClick={runDiscoveryNow}
            disabled={running}
            className="text-xs px-3 py-1.5 rounded-md bg-accent text-white flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <RefreshCcw size={12} className={running ? "animate-spin" : ""} /> {running ? "Running…" : "Refresh agents"}
          </button>
        </div>
      </div>
      {note && <p className="text-xs text-text-muted -mt-4">{note}</p>}

      <AgentStatusStrip agentStatuses={agentStatuses} running={running} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="IN PIPELINE" value={String(applications.length)} hint={`${programs.length} programs discovered`} />
        <KpiCard label="READY TO SUBMIT" value={String(readyCount)} hint="awaiting your review" hintColor="var(--success)" />
        <KpiCard label="DEADLINES ≤ 7 DAYS" value={String(urgentDeadlines)} hint={urgentDeadlines > 0 ? "act soon" : "none urgent"} hintColor={urgentDeadlines > 0 ? "var(--warning)" : undefined} />
        <KpiCard label="SUBMITTED" value={String(submittedCount)} hint="this period" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium">Discovery feed</p>
            <p className="text-xs text-text-muted">Programs your agents found. Drag onto the pipeline to start.</p>
          </div>
          {meta && <p className="text-[11px] text-text-muted">{meta.usingRealAgents ? "live agents" : "simulated"}</p>}
        </div>
        <DiscoveryFeed
          programs={programs}
          appliedProgramIds={appliedProgramIds}
          dropZoneRef={dropZoneRef}
          onMagnetChange={setMagnetActive}
          onDropProgram={handleDropProgram}
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Application pipeline</p>
        <PipelineBoard ref={dropZoneRef} applications={applications} magnetActive={magnetActive} />
      </div>
    </div>
  );
}
