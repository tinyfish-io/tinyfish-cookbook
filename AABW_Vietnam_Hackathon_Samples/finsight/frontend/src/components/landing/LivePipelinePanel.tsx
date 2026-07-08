import React from 'react';
import type { StageLogs, PipelineStage } from '../../context/IntelligenceContext';

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'fetch', label: 'Fetch' },
  { id: 'preflight', label: 'Preflight' },
  { id: 'synthesize', label: 'Synthesize' },
];

function statusColor(log: string): string {
  if (log.startsWith('✗')) return 'text-fs-red/90';
  if (log.startsWith('⚠')) return 'text-amber-300/90';
  if (log.startsWith('✓')) return 'text-fs-cyan/90';
  return 'text-white/65';
}

export function LivePipelinePanel({
  activeStage,
  stageLogs,
}: {
  activeStage: PipelineStage | null;
  stageLogs: StageLogs;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {STAGES.map((stage) => {
        const logs = stageLogs[stage.id];
        const isActive = activeStage === stage.id;
        const isComplete = logs.length > 0 && !isActive;

        return (
          <div
            key={stage.id}
            className={`rounded-lg border p-4 min-h-[160px] transition-colors ${
              isActive
                ? 'border-fs-gold/50 bg-fs-gold/5'
                : isComplete
                  ? 'border-white/15 bg-black/30'
                  : 'border-white/10 bg-black/20'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono-fs text-[0.65rem] uppercase tracking-widest text-fs-gold">
                {stage.label}
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  isActive
                    ? 'bg-fs-gold animate-pulse'
                    : isComplete
                      ? 'bg-fs-gold/50'
                      : 'bg-white/15'
                }`}
              />
            </div>
            <div className="font-mono-fs text-[0.62rem] space-y-1.5 max-h-[220px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-white/30 italic">Waiting…</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={statusColor(log)}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
