"use client";

import { useEffect, useRef } from "react";
import type { ProcessedPaper } from "@/lib/types";

/** Volume table of contents: every chapter, its status, and where the reader is. */
export function Contents({ state, current, onPick, onClose }: { state: ProcessedPaper; current: number; onPick: (n: number) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const plans = state.analysis?.chapterPlan ?? [];
  const chapters = state.story?.chapters ?? [];
  const failed = state.job?.stage === "error";
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Contents">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute top-0 left-0 bottom-0 w-full sm:w-[440px] bg-paper text-ink border-r-[3px] border-ink flex flex-col sheet-in">
        <div className="flex items-center border-b-[3px] border-ink">
          <div className="px-4 py-3 flex-1 min-w-0">
            <div className="font-display text-red text-[10px] tracking-[0.3em]">目次 · CONTENTS</div>
            <div className="font-bold text-sm truncate">{state.paper.title}</div>
          </div>
          <button onClick={onClose} className="w-12 self-stretch grid place-items-center border-l-[3px] border-ink hover:bg-ink hover:text-white text-xl" aria-label="Close contents">
            ×
          </button>
        </div>
        <ol className="flex-1 overflow-y-auto p-3 space-y-2">
          {plans.map((pl, i) => {
            const ch = chapters[i];
            const here = pl.number === current;
            return (
              <li key={pl.number}>
                <button
                  ref={i === 0 ? first : undefined}
                  disabled={!ch && !failed}
                  onClick={() => onPick(pl.number)}
                  className={`w-full text-left flex gap-3 items-start border-[3px] p-3 transition-all ${here ? "border-ink bg-ink text-white" : ch ? "border-ink bg-white hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)]" : "border-dashed border-ink/40 bg-paper-2 text-ink-3"}`}
                >
                  <span className={`font-display text-xl w-10 h-10 grid place-items-center shrink-0 ${here ? "bg-red text-white" : ch ? "bg-ink text-white" : "border-2 border-ink/30"}`}>{pl.number}</span>
                  <span className="min-w-0">
                    <span className={`block font-display text-xs ${here ? "text-red" : "text-red"}`}>{ch?.kicker}</span>
                    <span className="block font-bold leading-snug">{ch?.title ?? pl.title}</span>
                    <span className={`block text-xs mt-1 line-clamp-2 ${here ? "text-white/70" : "text-ink-3"}`}>{ch ? ch.summary || pl.focus : failed ? "Couldn’t be drawn yet — open to retry" : "Still being drawn…"}</span>
                  </span>
                  {here && <span className="ml-auto text-[10px] font-black tracking-wider bg-red text-white px-1.5 py-0.5 shrink-0">NOW</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
