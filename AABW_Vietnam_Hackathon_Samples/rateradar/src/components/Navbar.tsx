"use client";

import { useEffect, useState } from "react";

export type NavTab = "compare" | "apply" | "profile";

function useCountdown(targetIso: string | null) {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    if (!targetIso) return;
    const tick = () => {
      const diffMs = new Date(targetIso).getTime() - Date.now();
      if (diffMs <= 0) {
        setLabel("due now");
        return;
      }
      const totalMin = Math.floor(diffMs / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [targetIso]);
  return label;
}

export function Navbar({
  tab,
  onTabChange,
  syncing,
  hasSyncedBefore,
  nextSweepAt,
  onSync
}: {
  tab: NavTab;
  onTabChange: (t: NavTab) => void;
  syncing: boolean;
  hasSyncedBefore: boolean;
  nextSweepAt: string | null;
  onSync: () => void;
}) {
  const countdown = useCountdown(nextSweepAt);
  const label = syncing ? "Syncing" : hasSyncedBefore ? "Synced" : "Not synced yet";
  const dotColor = syncing ? "bg-amber live-dot" : hasSyncedBefore ? "bg-mint" : "bg-white/25";
  const textColor = syncing ? "text-amber" : hasSyncedBefore ? "text-mint" : "text-muted";

  return (
    <header className="sticky top-0 z-10 bg-ink/95 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-4">
        <nav className="flex gap-1">
          {(["compare", "apply", "profile"] as NavTab[]).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`text-sm font-medium px-3.5 py-1.5 rounded-md transition ${
                tab === t ? "bg-primary/25 text-gold" : "text-muted hover:text-paper"
              }`}
            >
              {t === "compare" ? "Compare rates" : t === "apply" ? "Apply" : "Your profile"}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-muted hidden md:inline">Next sweep in {countdown}</span>
          <span className={`text-[11px] font-medium flex items-center gap-1.5 ${textColor}`}>
            <span className={`h-1.5 w-1.5 rounded-full inline-block ${dotColor}`} />
            {label}
          </span>
          <button
            onClick={onSync}
            disabled={syncing}
            className="text-xs font-medium text-gold hover:underline disabled:opacity-40 disabled:no-underline"
          >
            Sync now
          </button>
        </div>
      </div>
    </header>
  );
}
