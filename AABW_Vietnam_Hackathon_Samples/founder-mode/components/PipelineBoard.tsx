"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, PenLine, CheckCircle2, Send, Magnet } from "lucide-react";
import type { Application, ApplicationStage } from "@/lib/types";

const COLUMNS: { stage: ApplicationStage; label: string; icon: typeof Loader2; color: string }[] = [
  { stage: "extracting", label: "Extracting", icon: Loader2, color: "var(--accent)" },
  { stage: "drafting", label: "Drafting", icon: PenLine, color: "var(--warning)" },
  { stage: "ready", label: "Ready for review", icon: CheckCircle2, color: "var(--success)" },
  { stage: "submitted", label: "Submitted", icon: Send, color: "var(--text-secondary)" },
];

const PipelineBoard = forwardRef<HTMLDivElement, { applications: Application[]; magnetActive: boolean }>(
  ({ applications, magnetActive }, dropZoneRef) => {
    return (
      <div>
        <motion.div
          ref={dropZoneRef}
          animate={
            magnetActive
              ? { scale: 1.015, borderColor: "var(--accent)" }
              : { scale: 1, borderColor: "var(--border)" }
          }
          transition={{ type: "spring", stiffness: 350, damping: 20 }}
          className="rounded-xl border-2 border-dashed p-4 mb-4 text-center text-xs relative overflow-hidden"
          style={{ borderColor: magnetActive ? "var(--accent)" : "var(--border)" }}
        >
          {magnetActive && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 1.1, repeat: Infinity }}
              style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
            />
          )}
          <motion.div
            animate={magnetActive ? { scale: [1, 1.2, 1], rotate: [0, -8, 8, 0] } : { scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, repeat: magnetActive ? Infinity : 0 }}
            className="flex items-center justify-center gap-1.5 relative"
          >
            <Magnet size={13} style={{ color: magnetActive ? "var(--accent)" : "var(--text-muted)" }} />
            <span style={{ color: magnetActive ? "var(--accent)" : "var(--text-muted)" }}>
              {magnetActive ? "Release to start this application" : "Drag a program from the discovery feed above and drop it here"}
            </span>
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map((col) => {
            const items = applications.filter((a) => a.stage === col.stage);
            const Icon = col.icon;
            return (
              <div key={col.stage}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={12} style={{ color: col.color }} className={col.stage === "extracting" ? "animate-spin" : ""} />
                  <p className="text-xs font-medium text-text-secondary">{col.label}</p>
                  <span className="text-xs text-text-muted font-mono">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[60px]">
                  {items.map((app) => (
                    <motion.div
                      key={app.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    >
                      <Link href={`/applications/${app.id}`} className="block card-surface rounded-lg p-3 text-left">
                        <p className="text-xs font-medium mb-1">{app.programName}</p>
                        <p className="text-[11px] text-text-muted line-clamp-2">{app.statusNote}</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

PipelineBoard.displayName = "PipelineBoard";
export default PipelineBoard;
