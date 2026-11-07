"use client";

import Link from "next/link";
import type { JobStage, ProcessedPaper } from "@/lib/types";
import { Sumi, type SumiMode } from "@/components/mascot/Sumi";
import { Scene } from "@/components/manga/scenes";

// The "now inking" screen shown inside the reader while a paper is being prepared.
// Everything on it comes from the real job: stage, log lines, chapters as they finish.

const STAGES: { key: JobStage; jp: string; label: string; mascot: SumiMode }[] = [
  { key: "acquiring", jp: "取得", label: "Retrieving the paper", mascot: "scouting" },
  { key: "analyzing", jp: "読解", label: "Understanding the research", mascot: "reading" },
  { key: "drawing", jp: "作画", label: "Drawing the chapters", mascot: "inking" },
];
const ORDER: JobStage[] = ["queued", "acquiring", "analyzing", "drawing", "done"];

export function Preparing({ state, starting, onStart }: { state: ProcessedPaper; starting: boolean; onStart: (restart?: boolean) => void }) {
  const { paper, job, analysis, story } = state;
  const failed = job?.stage === "error";
  const notStarted = !job && !starting;
  const at = job ? ORDER.indexOf(job.stage) : 0;
  const doneUpTo = failed ? (analysis ? 2 : state.acquisition ? 1 : 0) : at - 1;
  const current = STAGES.find((s) => s.key === job?.stage);
  const mascot: SumiMode = failed ? "dizzy" : notStarted ? "interactive" : (current?.mascot ?? "scouting");
  const bubble = failed ? "Something got stuck. Let’s try that again." : notStarted ? "Ready when you are!" : (job?.message ?? "Getting started…");

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden">
      <Scene id="focus" seed={11} className="absolute inset-0 w-full h-full invert opacity-[0.08] opening-drift" />
      <div className="relative max-w-[980px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="font-mono text-[11px] tracking-[0.3em] text-red">第一巻 · {failed ? "中断 · PAUSED" : notStarted ? "準備 · READY TO DRAW" : "制作中 · NOW INKING"}</div>
        <h1 className="font-display text-[clamp(26px,4vw,46px)] leading-[1.05] mt-3 max-w-[28ch]" style={{ textWrap: "balance" }}>
          {paper.title}
        </h1>

        <div className="mt-10 grid md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-start">
          <div className="flex md:flex-col items-center gap-4">
            <div className="grid place-items-center w-[170px] h-[170px] rounded-full bg-paper shadow-[0_0_0_6px_rgba(255,255,255,0.08),0_0_70px_rgba(255,255,255,0.15)]">
              <Sumi mode={mascot} size={140} />
            </div>
            <div className="relative bg-white text-ink border-[2.5px] border-ink rounded-[46%/50%] px-4 py-2.5 lettering text-[15px] max-w-[230px] text-center" aria-live="polite">
              {bubble}
            </div>
          </div>

          <div className="min-w-0">
            {notStarted || failed ? (
              <div>
                <p className="text-white/80 text-lg leading-relaxed max-w-[52ch]">
                  {failed
                    ? job?.error
                    : "This paper hasn’t been drawn yet. Kenshō will retrieve the openly available text with TinyFish, extract its claims, and draw the chapters. It usually takes one to three minutes."}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={() => onStart(false)} disabled={starting} className="btn-ink text-lg">
                    {starting ? "STARTING…" : failed ? "RESUME ▸" : "DRAW THIS PAPER ▸"}
                  </button>
                  {failed && (
                    <button onClick={() => onStart(true)} className="border-2 border-white/40 px-4 py-2 font-bold hover:border-white">
                      Start over
                    </button>
                  )}
                  <Link href={`/paper/${paper.id}`} className="border-2 border-white/40 px-4 py-2 font-bold hover:border-white">
                    Back to paper
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <ol className="grid sm:grid-cols-3 gap-2.5">
                  {STAGES.map((s, i) => {
                    const done = i < doneUpTo || job?.stage === "done";
                    const active = !failed && job?.stage === s.key;
                    return (
                      <li key={s.key} className={`border-2 p-3 transition-colors ${active ? "border-white bg-white text-ink" : done ? "border-white/60" : "border-white/15 text-white/40"}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm">{s.jp}</span>
                          {done && <span className="ml-auto font-black">✓</span>}
                          {active && <span className="ml-auto w-3 h-3 border-2 border-ink border-t-transparent rounded-full animate-spin" />}
                        </div>
                        <div className="font-bold text-sm mt-1">{s.label}</div>
                        {s.key === "drawing" && job && job.chaptersTotal > 0 && (
                          <div className={`text-xs mt-1 ${active ? "text-ink-3" : ""}`}>
                            {job.chaptersDone} of {job.chaptersTotal} chapters
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {analysis && (
                  <ul className="mt-6 grid gap-2">
                    {analysis.chapterPlan.map((pl, i) => {
                      const ch = story?.chapters[i];
                      return (
                        <li key={pl.number} className={`flex items-center gap-3 border px-3 py-2 ${ch ? "border-white bg-white/5 ink-in" : "border-white/15"}`}>
                          <span className={`font-display w-7 h-7 grid place-items-center text-sm ${ch ? "bg-red text-white" : "border border-white/30 text-white/50"}`}>{pl.number}</span>
                          <span className={`flex-1 text-sm font-bold truncate ${ch ? "" : "text-white/50"}`}>{ch?.title ?? pl.title}</span>
                          <span className="font-mono text-[11px] text-white/60">{ch ? "inked ✓" : "drawing…"}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <ul className="mt-6 font-mono text-xs space-y-1 text-white/55 max-h-40 overflow-hidden" aria-label="Progress log">
                  {(job?.log ?? []).slice(-5).map((l, i, arr) => (
                    <li key={i} className={i === arr.length - 1 ? "text-white" : ""}>
                      <span className="opacity-50">{new Date(l.at).toLocaleTimeString()}</span> {l.text}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm text-white/50">Chapter one opens automatically as soon as it’s inked.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
