"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Application, ApplicationStage } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";

const STAGE_LABEL: Record<ApplicationStage, string> = {
  discovered: "Discovered",
  extracting: "Extracting",
  drafting: "Drafting",
  ready: "Ready for review",
  submitted: "Submitted",
};

const STAGE_COLOR: Record<ApplicationStage, string> = {
  discovered: "var(--text-muted)",
  extracting: "var(--accent)",
  drafting: "var(--warning)",
  ready: "var(--success)",
  submitted: "var(--text-secondary)",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/applications");
      setApplications(data.applications);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load applications</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }

  if (!loaded) return <div className="skeleton h-96" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Applications</h1>
        <p className="text-sm text-text-muted mt-1">Every application in progress, from extraction through submission.</p>
      </div>

      {applications.length === 0 ? (
        <p className="text-sm text-text-muted py-10 text-center">No applications yet — drag a program into the pipeline from the dashboard.</p>
      ) : (
        <div className="card-surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary text-xs border-b border-border">
                <th className="font-normal px-4 py-2.5">Program</th>
                <th className="font-normal px-4 py-2.5">Status</th>
                <th className="font-normal px-4 py-2.5">Started</th>
                <th className="font-normal px-4 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/applications/${app.id}`} className="font-medium hover:text-accent transition-colors">
                      {app.programName}
                    </Link>
                    <p className="text-xs text-text-muted mt-0.5">{app.statusNote}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${STAGE_COLOR[app.stage]}1A`, color: STAGE_COLOR[app.stage] }}>
                      {STAGE_LABEL[app.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(app.createdAt)}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(app.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
