"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin, Clock, ExternalLink } from "lucide-react";
import type { Program } from "@/lib/types";
import { formatDeadline } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";

export default function DiscoverPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/programs");
      setPrograms(data.programs);
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
        <p className="text-sm font-medium text-danger mb-1">Couldn't load programs</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }

  if (!loaded) {
    return <div className="skeleton h-96" />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Discover</h1>
        <p className="text-sm text-text-muted mt-1">Every program your agents have found across VIISA, VSV Capital, ThinkZone, Antler Vietnam, Techfest, and F6S.</p>
      </div>
      <div className="card-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary text-xs border-b border-border">
              <th className="font-normal px-4 py-2.5">Program</th>
              <th className="font-normal px-4 py-2.5">Type</th>
              <th className="font-normal px-4 py-2.5">Location</th>
              <th className="font-normal px-4 py-2.5">Funding</th>
              <th className="font-normal px-4 py-2.5">Deadline</th>
              <th className="font-normal px-4 py-2.5">Match</th>
              <th className="font-normal px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-text-secondary">{p.type}</td>
                <td className="px-4 py-3 text-text-secondary">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {p.location}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary">{p.fundingSummary}</td>
                <td className="px-4 py-3 text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {formatDeadline(p.deadline)}
                  </span>
                </td>
                <td className="px-4 py-3 tabular">{p.matchScore}%</td>
                <td className="px-4 py-3">
                  <a href={p.applyUrl} target="_blank" rel="noreferrer" className="text-accent hover:opacity-80">
                    <ExternalLink size={13} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
