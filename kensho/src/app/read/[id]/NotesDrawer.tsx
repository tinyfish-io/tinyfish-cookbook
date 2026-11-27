"use client";

import { useEffect, useRef } from "react";
import type { ClaimKind, ProcessedPaper } from "@/lib/types";
import { library, type SavedConcept } from "@/lib/library";

export type DrawerTab = "sources" | "terms" | "saved";

const KIND_LABEL: Record<ClaimKind, string> = {
  problem: "Problem",
  background: "Background",
  method: "Method",
  finding: "Finding",
  limitation: "Limitation",
  conclusion: "Conclusion",
};

export function NotesDrawer({
  open,
  tab,
  focus,
  onTab,
  onClose,
  state,
  saved,
}: {
  open: boolean;
  tab: DrawerTab;
  focus: string | null;
  onTab: (t: DrawerTab) => void;
  onClose: () => void;
  state: ProcessedPaper;
  saved: SavedConcept[];
}) {
  const body = useRef<HTMLDivElement>(null);
  const analysis = state.analysis!;
  const heading = (sid: string) => state.acquisition?.sections.find((s) => s.id === sid)?.heading;

  useEffect(() => {
    if (!open || !focus) return;
    const t = setTimeout(() => body.current?.querySelector(`[data-key="${CSS.escape(focus)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    return () => clearTimeout(t);
  }, [open, focus, tab]);

  const isSaved = (term: string) => saved.some((s) => s.term.toLowerCase() === term.toLowerCase());

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={onClose} aria-hidden />
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[440px] bg-paper text-ink border-l-[3px] border-ink flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Notes"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex items-center border-b-[3px] border-ink">
          {(
            [
              ["sources", "出典", "Sources"],
              ["terms", "用語", "Terms"],
              ["saved", "保存", `Saved${saved.length ? ` (${saved.length})` : ""}`],
            ] as const
          ).map(([k, jp, label]) => (
            <button key={k} onClick={() => onTab(k)} className={`flex-1 py-3 text-sm font-bold border-r-2 border-ink last:border-r-0 ${tab === k ? "bg-ink text-white" : "hover:bg-paper-2"}`} aria-pressed={tab === k}>
              <span className="font-display text-[10px] block text-red">{jp}</span>
              {label}
            </button>
          ))}
          <button onClick={onClose} className="w-12 self-stretch grid place-items-center border-l-[3px] border-ink hover:bg-ink hover:text-white text-xl" aria-label="Close notes">
            ×
          </button>
        </div>

        <div ref={body} className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === "sources" && (
            <>
              <div className="border-2 border-ink bg-white p-3 text-sm">
                <div className="font-bold leading-snug">{state.paper.title}</div>
                <div className="text-ink-3 text-xs mt-1">
                  {state.paper.authors.slice(0, 4).join(", ")}
                  {state.paper.authors.length > 4 ? " et al." : ""} {state.paper.year ? `(${state.paper.year})` : ""}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <a className="text-xs font-bold underline" href={state.paper.url} target="_blank" rel="noopener noreferrer">
                    Original ↗
                  </a>
                  {state.acquisition && (
                    <a className="text-xs font-bold underline" href={state.acquisition.sourceUrl} target="_blank" rel="noopener noreferrer">
                      Text we read ↗
                    </a>
                  )}
                </div>
                {state.acquisition?.mode === "abstract_only" && <p className="mt-2 text-xs text-red font-bold">Built from the abstract only — the full text wasn’t openly accessible.</p>}
              </div>
              <p className="text-xs text-ink-3 leading-relaxed">
                Each claim pairs a plain-language statement with a short verbatim excerpt. <span className="text-red font-bold">検証</span> means we found the excerpt in the
                retrieved text.
              </p>
              {analysis.claims.map((c) => (
                <article
                  key={c.id}
                  data-key={c.id}
                  className={`border-2 bg-white p-3 transition-shadow ${focus === c.id ? "border-red shadow-[4px_4px_0_var(--red)]" : "border-ink"}`}
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono bg-ink text-white px-1.5 py-0.5">{c.id}</span>
                    <span className="font-bold uppercase tracking-wider">{KIND_LABEL[c.kind]}</span>
                    <span className={`ml-auto font-bold ${c.verified ? "text-red" : "text-ink-3"}`}>{c.verified ? "検証 verified" : "unverified"}</span>
                  </div>
                  <p className="mt-2 font-bold text-[15px] leading-snug">{c.statement}</p>
                  <blockquote className="mt-2 font-serif text-[15px] leading-snug border-l-[3px] border-ink pl-2.5 text-ink-2">“{c.quote}”</blockquote>
                  <div className="mt-2 font-mono text-[11px] text-ink-3">
                    § {c.sectionId}
                    {heading(c.sectionId) ? ` · ${heading(c.sectionId)}` : ""}
                  </div>
                </article>
              ))}
            </>
          )}

          {tab === "terms" &&
            (analysis.glossary.length ? (
              analysis.glossary.map((g) => (
                <article key={g.term} data-key={g.term} className={`border-2 bg-white p-3 ${focus?.toLowerCase() === g.term.toLowerCase() ? "border-red shadow-[4px_4px_0_var(--red)]" : "border-ink"}`}>
                  <div className="flex items-start gap-2">
                    <h3 className="font-display text-lg leading-tight flex-1">{g.term}</h3>
                    <button
                      onClick={() => library.toggleConcept({ ...g, paperId: state.paper.id, paperTitle: state.paper.title })}
                      className={`text-xs font-bold border-2 border-ink px-2 py-1 shrink-0 ${isSaved(g.term) ? "bg-ink text-white" : "hover:bg-paper-2"}`}
                      aria-pressed={isSaved(g.term)}
                    >
                      {isSaved(g.term) ? "★ Saved" : "☆ Save"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed">{g.definition}</p>
                </article>
              ))
            ) : (
              <p className="text-ink-3">No glossary for this paper.</p>
            ))}

          {tab === "saved" &&
            (saved.length ? (
              saved.map((s) => (
                <article key={s.term} className="border-2 border-ink bg-white p-3">
                  <div className="flex items-start gap-2">
                    <h3 className="font-display text-lg leading-tight flex-1">{s.term}</h3>
                    <button onClick={() => library.toggleConcept(s)} className="text-xs font-bold underline">
                      Remove
                    </button>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed">{s.definition}</p>
                </article>
              ))
            ) : (
              <p className="text-ink-3 text-sm">Tap an underlined term in any bubble, then ☆ Save it to build your concept deck.</p>
            ))}
        </div>
      </aside>
    </>
  );
}
