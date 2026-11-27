"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chapter, ProcessedPaper, Term } from "@/lib/types";
import { api, library, useLibrary } from "@/lib/library";
import { MangaPageView } from "@/components/manga/MangaPage";
import { ReaderContext, type ReaderCtx } from "@/components/manga/reader-context";
import { Character } from "@/components/manga/characters";
import { Scene } from "@/components/manga/scenes";
import { Quiz } from "@/components/Quiz";
import { NotesDrawer, type DrawerTab } from "./NotesDrawer";
import { Preparing } from "./Preparing";
import { ChapterCover } from "./ChapterCover";
import { Contents } from "./Contents";
import { Sumi } from "@/components/mascot/Sumi";

type Mode = "page" | "scroll";
const MODE_KEY = "kensho.readmode";

export function Reader({
  id,
  initialChapter,
  initialPage,
  initialClaim,
  autoStart = false,
}: {
  id: string;
  initialChapter: number;
  initialPage: number;
  initialClaim: string | null;
  autoStart?: boolean;
}) {
  const [state, setState] = useState<ProcessedPaper | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chapterNo, setChapterNo] = useState(initialChapter);
  const [pageNo, setPageNo] = useState(initialPage); // 1-based; pages.length + 1 = end card
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [mode, setMode] = useState<Mode>("page");
  const [drawer, setDrawer] = useState<{ open: boolean; tab: DrawerTab; focus: string | null }>({ open: !!initialClaim, tab: "sources", focus: initialClaim });
  const [chrome, setChrome] = useState(true);
  const [cover, setCover] = useState<number | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const autoStarted = useRef(false);
  const hadChapters = useRef<boolean | null>(null);
  const lib = useLibrary();

  const load = useCallback(() => {
    api<ProcessedPaper>(`/api/papers/${id}`)
      .then(setState)
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "scroll" || m === "page") setMode(m);
      else if (window.innerWidth < 640) setMode("scroll");
    } catch {}
  }, []);
  const switchMode = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  const start = useCallback(
    async (restart = false) => {
      setStarting(true);
      try {
        await api(`/api/papers/${id}/process`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restart }) });
        load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setStarting(false);
      }
    },
    [id, load],
  );

  // Arriving from "Read as manga": begin drawing straight away instead of asking again.
  // Only for a paper never attempted (or an explicit ?start=1 retry), never in a loop.
  useEffect(() => {
    if (!state || autoStarted.current || state.story?.chapters.some(Boolean)) return;
    const neverRun = !state.job;
    const retryRequested = autoStart && state.job?.stage === "error";
    if (neverRun || retryRequested) {
      autoStarted.current = true;
      start(false);
    }
  }, [state, autoStart, start]);

  const drawing = !!state?.job && !["done", "error"].includes(state.job.stage);
  useEffect(() => {
    if (!drawing) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [drawing, load]);

  const chapters = state?.story?.chapters ?? [];
  const total = state?.analysis?.chapterPlan.length ?? chapters.length;

  // Chapter title card: on opening a chapter from its first page, and when chapter one
  // finishes inking while the reader watches the preparation screen.
  const hasChapters = chapters.some(Boolean);
  useEffect(() => {
    if (!state) return;
    if (hadChapters.current === null) {
      hadChapters.current = hasChapters;
      if (hasChapters && initialPage === 1 && !initialClaim && chapters[initialChapter - 1]) setCover(initialChapter);
      return;
    }
    if (!hadChapters.current && hasChapters) {
      hadChapters.current = true;
      setChapterNo(1);
      setPageNo(1);
      setCover(1);
    }
  }, [state, hasChapters, chapters, initialChapter, initialPage, initialClaim]);
  const chapter: Chapter | null = chapters[chapterNo - 1] ?? null;
  const pageCount = chapter?.pages.length ?? 0;
  const atEnd = pageNo > pageCount;

  // Persist progress + keep the URL shareable without re-rendering the route.
  useEffect(() => {
    if (!state || !chapter) return;
    const p = Math.min(pageNo, pageCount);
    library.setProgress(id, state.paper.title, { chapter: chapterNo, page: p, totalChapters: total });
    const url = `/read/${id}?ch=${chapterNo}&p=${p}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [id, state, chapter, chapterNo, pageNo, pageCount, total]);

  const go = useCallback(
    (delta: number) => {
      setDir(delta > 0 ? "next" : "prev");
      if (delta > 0) {
        if (pageNo <= pageCount) setPageNo(pageNo + 1);
        else if (chapterNo < total && chapters[chapterNo]) {
          setChapterNo(chapterNo + 1);
          setPageNo(1);
          setCover(chapterNo + 1);
        }
      } else {
        if (pageNo > 1) setPageNo(pageNo - 1);
        else if (chapterNo > 1 && chapters[chapterNo - 2]) {
          setChapterNo(chapterNo - 1);
          setPageNo((chapters[chapterNo - 2]?.pages.length ?? 0) + 1);
        }
      }
      if (mode === "page") window.scrollTo({ top: 0 });
    },
    [pageNo, pageCount, chapterNo, total, chapters, mode],
  );

  const jumpChapter = (n: number) => {
    setDir(n > chapterNo ? "next" : "prev");
    setChapterNo(n);
    setPageNo(1);
    setContentsOpen(false);
    if (n !== chapterNo) setCover(n);
    window.scrollTo({ top: 0 });
  };
  const closeCover = useCallback(() => setCover(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (cover !== null || contentsOpen) return;
      if (e.key === "Escape") setDrawer((d) => ({ ...d, open: false }));
      if (mode !== "page") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, mode, cover, contentsOpen]);

  // Swipe to turn pages on touch screens.
  const touch = useRef<{ x: number; y: number } | null>(null);

  const ctx: ReaderCtx = useMemo(
    () => ({
      claims: new Map((state?.analysis?.claims ?? []).map((c) => [c.id, c])),
      glossary: state?.analysis?.glossary ?? [],
      sectionHeading: (sid: string) => state?.acquisition?.sections.find((s) => s.id === sid)?.heading,
      openClaim: (cid: string) => setDrawer({ open: true, tab: "sources", focus: cid }),
      openTerm: (t: Term) => setDrawer({ open: true, tab: "terms", focus: t.term }),
    }),
    [state],
  );

  if (error)
    return (
      <Shell>
        <div className="text-center text-white py-24">
          <p className="font-display text-2xl">{error}</p>
          <Link href="/search" className="btn-ink mt-6">
            SEARCH PAPERS
          </Link>
        </div>
      </Shell>
    );
  if (!state)
    return (
      <Shell>
        <div className="grid place-items-center h-[70vh] text-white font-mono text-sm">Opening the volume…</div>
      </Shell>
    );
  if (!state.analysis || !chapters.some(Boolean))
    return (
      <Shell>
        <Preparing state={state} starting={starting} onStart={start} />
      </Shell>
    );

  const seedKey = `${id}-${chapterNo}`;
  const bookmarked = !!lib.bookmarks[id];

  return (
    <ReaderContext.Provider value={ctx}>
      <div className="min-h-dvh bg-[#121213] text-white">
        {/* ── volume progress across all chapters ── */}
        <div className="fixed top-0 inset-x-0 h-[3px] z-50 bg-white/10" aria-hidden>
          <div
            className="h-full bg-red transition-[width] duration-500"
            style={{ width: `${total ? ((chapterNo - 1 + Math.min(pageNo, pageCount + 1) / Math.max(1, pageCount + 1)) / total) * 100 : 0}%` }}
          />
        </div>
        {/* ── top bar ── */}
        <header className={`fixed top-0 inset-x-0 z-40 transition-transform duration-300 ${chrome ? "" : "-translate-y-full"}`}>
          <div className="bg-ink/95 backdrop-blur border-b border-white/15">
            <div className="max-w-[1400px] mx-auto px-3 sm:px-5 h-14 flex items-center gap-2 sm:gap-4">
              <Link href={`/paper/${id}`} className="w-9 h-9 grid place-items-center hover:bg-white/10 shrink-0" aria-label="Back to paper">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 3 L5 9 L11 15" />
                </svg>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-mono text-white/55 truncate">{state.paper.title}</div>
                <button
                  onClick={() => setContentsOpen(true)}
                  className="flex items-center gap-1.5 max-w-full font-display text-sm sm:text-base hover:text-red transition-colors"
                  aria-haspopup="dialog"
                  title="Contents"
                >
                  <span className="text-red shrink-0">{chapter?.kicker}</span>
                  <span className="truncate">{chapter?.title ?? "Contents"}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" aria-hidden>
                    <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </button>
              </div>
              <div className="hidden sm:flex border border-white/30" role="group" aria-label="Reading mode">
                {(["page", "scroll"] as const).map((m) => (
                  <button key={m} onClick={() => switchMode(m)} className={`px-3 py-1.5 text-xs font-bold tracking-wider ${mode === m ? "bg-white text-ink" : "hover:bg-white/10"}`} aria-pressed={mode === m}>
                    {m === "page" ? "PAGE" : "SCROLL"}
                  </button>
                ))}
              </div>
              <button onClick={() => switchMode(mode === "page" ? "scroll" : "page")} className="sm:hidden px-2 py-1.5 text-[11px] font-bold border border-white/30">
                {mode === "page" ? "SCROLL" : "PAGE"}
              </button>
              <button onClick={() => library.toggleBookmark(state.paper)} className={`w-9 h-9 grid place-items-center ${bookmarked ? "text-red" : "hover:bg-white/10"}`} aria-pressed={bookmarked} aria-label="Bookmark paper">
                <svg width="14" height="18" viewBox="0 0 12 15" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M1 1 H11 V14 L6 10 L1 14 Z" />
                </svg>
              </button>
              <button onClick={() => setDrawer((d) => ({ ...d, open: !d.open, focus: null }))} className="px-3 h-9 text-xs font-bold tracking-wider bg-white text-ink hover:bg-red hover:text-white transition-colors">
                NOTES
              </button>
            </div>
          </div>
        </header>

        <main
          className="pt-20 pb-24 px-2 sm:px-6"
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            if (mode !== "page" || !touch.current) return;
            const dx = e.changedTouches[0].clientX - touch.current.x;
            const dy = e.changedTouches[0].clientY - touch.current.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
            touch.current = null;
          }}
        >
          {!chapter ? (
            <ChapterPending n={chapterNo} failed={state.job?.stage === "error"} error={state.job?.error ?? null} starting={starting} onRetry={() => start(false)} />
          ) : mode === "page" ? (
            <div className="relative max-w-[820px] mx-auto">
              <ChapterTitle chapter={chapter} show={pageNo === 1} />
              <div key={`${chapterNo}-${pageNo}`} className={dir === "next" ? "page-in-next" : "page-in-prev"} onClick={() => setChrome((c) => !c)}>
                {atEnd ? (
                  <EndCard state={state} chapter={chapter} total={total} onNext={() => go(1)} onQuizClaim={(c) => ctx.openClaim(c)} />
                ) : (
                  <MangaPageView page={chapter.pages[pageNo - 1]} pageNumber={pageNo} chapterKicker={`${chapter.kicker} ${chapter.title}`} seedKey={seedKey} className="shadow-[0_30px_80px_rgba(0,0,0,0.55)]" />
                )}
              </div>
              <TurnButton side="left" onClick={() => go(-1)} disabled={chapterNo === 1 && pageNo === 1} />
              <TurnButton side="right" onClick={() => go(1)} disabled={atEnd && (chapterNo >= total || !chapters[chapterNo])} />
            </div>
          ) : (
            <ScrollChapter key={chapterNo} chapter={chapter} seedKey={seedKey} onPage={setPageNo} initialPage={pageNo} state={state} total={total} onNext={() => jumpChapter(chapterNo + 1)} onQuizClaim={(c) => ctx.openClaim(c)} />
          )}
        </main>

        {/* ── progress ── */}
        {chapter && (
          <footer className={`fixed bottom-0 inset-x-0 z-30 bg-ink/95 backdrop-blur border-t border-white/15 transition-transform duration-300 ${chrome ? "" : "translate-y-full"}`}>
            <div className="max-w-[1400px] mx-auto px-3 sm:px-5 h-12 flex items-center gap-3">
              <button onClick={() => chapterNo > 1 && jumpChapter(chapterNo - 1)} disabled={chapterNo <= 1 || !chapters[chapterNo - 2]} className="text-xs font-bold disabled:opacity-30 hover:text-red shrink-0">
                ◂ CH.{chapterNo - 1 || "–"}
              </button>
              <div className="flex-1 flex gap-1" aria-label={`Page ${Math.min(pageNo, pageCount)} of ${pageCount}`}>
                {Array.from({ length: pageCount + 1 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setDir(i + 1 > pageNo ? "next" : "prev");
                      setPageNo(i + 1);
                      if (mode === "scroll") document.getElementById(`pg-${i + 1}`)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`h-1.5 flex-1 transition-colors ${i + 1 === pageNo ? "bg-red" : i + 1 < pageNo ? "bg-white" : "bg-white/25"} ${i === pageCount ? "max-w-6" : ""}`}
                    aria-label={i === pageCount ? "Chapter end" : `Page ${i + 1}`}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] text-white/70 shrink-0 w-24 text-right">
                CH.{chapterNo}/{total} · P.{Math.min(pageNo, pageCount)}/{pageCount}
              </span>
              <button onClick={() => chapterNo < total && jumpChapter(chapterNo + 1)} disabled={chapterNo >= total || !chapters[chapterNo]} className="text-xs font-bold disabled:opacity-30 hover:text-red shrink-0">
                CH.{chapterNo + 1 > total ? "–" : chapterNo + 1} ▸
              </button>
            </div>
          </footer>
        )}

        {cover !== null && chapters[cover - 1] && <ChapterCover chapter={chapters[cover - 1]!} total={total} onDone={closeCover} />}
        {contentsOpen && <Contents state={state} current={chapterNo} onPick={jumpChapter} onClose={() => setContentsOpen(false)} />}

        <NotesDrawer
          open={drawer.open}
          tab={drawer.tab}
          focus={drawer.focus}
          onTab={(tab) => setDrawer((d) => ({ ...d, tab, focus: null }))}
          onClose={() => setDrawer((d) => ({ ...d, open: false }))}
          state={state}
          saved={lib.concepts.filter((c) => c.paperId === id)}
        />
      </div>
    </ReaderContext.Provider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#121213] text-white">
      <div className="h-14 border-b border-white/15 flex items-center gap-4 px-4 sm:px-5">
        <Link href="/" className="font-display">
          KENSHŌ<span className="text-red">.</span>
        </Link>
        <span className="hidden sm:inline font-mono text-[11px] tracking-[0.14em] text-white/50">01 DISCOVER — 02 PAPER — <span className="bg-white text-ink px-1.5 py-0.5">03 READ</span></span>
        <Link href="/library" className="ml-auto text-sm font-bold hover:text-red">
          Library
        </Link>
      </div>
      {children}
    </div>
  );
}

function TurnButton({ side, onClick, disabled }: { side: "left" | "right"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous page" : "Next page"}
      className={`hidden md:grid fixed top-1/2 -translate-y-1/2 ${side === "left" ? "left-4 lg:left-8" : "right-4 lg:right-8"} w-12 h-24 place-items-center border-2 border-white/30 text-white hover:bg-white hover:text-ink transition-colors disabled:opacity-0`}
    >
      <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d={side === "left" ? "M12 2 L3 12 L12 22" : "M4 2 L13 12 L4 22"} />
      </svg>
    </button>
  );
}

function ChapterTitle({ chapter, show }: { chapter: Chapter; show: boolean }) {
  if (!show) return null;
  return (
    <div className="mb-5 flex items-end gap-4 text-white ink-in">
      <span className="font-display text-red text-3xl sm:text-5xl leading-none whitespace-nowrap shrink-0">{chapter.kicker}</span>
      <div className="min-w-0">
        <div className="font-mono text-[11px] text-white/50 tracking-widest">CHAPTER {chapter.number}</div>
        <h1 className="font-display text-2xl sm:text-3xl leading-tight">{chapter.title}</h1>
      </div>
    </div>
  );
}

function ChapterPending({ n, failed, error, starting, onRetry }: { n: number; failed: boolean; error: string | null; starting: boolean; onRetry: () => void }) {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center text-center py-24">
      <div className="grid place-items-center w-[150px] h-[150px] rounded-full bg-paper">
        <Sumi mode={failed ? "dizzy" : "inking"} size={124} />
      </div>
      {failed ? (
        <>
          <p className="font-display text-2xl mt-6">Chapter {n} couldn’t be drawn yet.</p>
          {error && <p className="text-white/60 mt-2 text-sm">{error.slice(0, 180)}</p>}
          <button onClick={onRetry} disabled={starting} className="btn-ink mt-6">
            {starting ? "RETRYING…" : "RETRY MISSING CHAPTERS ▸"}
          </button>
        </>
      ) : (
        <>
          <p className="font-display text-2xl mt-6">Chapter {n} is still being inked…</p>
          <p className="text-white/60 mt-2 text-sm">It will appear here automatically when it’s ready.</p>
        </>
      )}
    </div>
  );
}

function EndCard({ state, chapter, total, onNext, onQuizClaim }: { state: ProcessedPaper; chapter: Chapter; total: number; onNext: () => void; onQuizClaim: (id: string) => void }) {
  const last = chapter.number >= total;
  const nextReady = !!state.story?.chapters[chapter.number];
  const nextPlan = state.analysis?.chapterPlan[chapter.number];
  return (
    <article className="relative bg-white text-ink overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="relative h-56 sm:h-72 border-b-[4px] border-ink overflow-hidden">
        <Scene id={last ? "sparkle" : "focus"} seed={chapter.number * 7} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="bg-ink text-white px-6 py-3 -rotate-2 shadow-[8px_8px_0_var(--red)] text-center">
            <div className="font-display text-4xl sm:text-6xl leading-none">{last ? "完" : "続く"}</div>
            <div className="font-mono text-[11px] tracking-[0.3em] mt-1">{last ? "FIN" : "TO BE CONTINUED"}</div>
          </div>
        </div>
        <div className="absolute bottom-0 right-2 w-32 sm:w-40">
          <Character id="kai" expression={last ? "excited" : "happy"} pose={last ? "cheer" : "point"} flip />
        </div>
      </div>
      <div className="p-6 sm:p-10">
        <div className="font-display text-red text-xs tracking-[0.3em]">この章で学んだこと · TAKEAWAY</div>
        <p className="text-xl font-bold mt-2 leading-snug max-w-[50ch]">{chapter.summary}</p>
        {!last && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button onClick={onNext} disabled={!nextReady} className="btn-ink text-lg">
              {nextReady ? `NEXT: ${state.story!.chapters[chapter.number]!.title}` : `CHAPTER ${chapter.number + 1} IS INKING…`} ▸
            </button>
            {nextPlan && <span className="text-sm text-ink-3">{nextPlan.focus}</span>}
          </div>
        )}
        {last && state.analysis && (
          <>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <div className="border-[3px] border-ink p-4">
                <div className="font-display text-sm tracking-widest">WHAT THE AUTHORS CONCLUDE</div>
                <p className="mt-2 text-[15px] leading-relaxed">{state.analysis.sections.conclusions}</p>
              </div>
              <div className="border-[3px] border-dashed border-ink p-4">
                <div className="font-display text-sm tracking-widest">LIMITATIONS</div>
                <p className="mt-2 text-[15px] leading-relaxed">{state.analysis.sections.limitations}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={state.paper.url} target="_blank" rel="noopener noreferrer" className="btn-ink">
                READ THE ORIGINAL PAPER ↗
              </a>
              <Link href={`/paper/${state.paper.id}`} className="btn-line">
                Related research
              </Link>
            </div>
            {state.analysis.quiz.length > 0 && (
              <div className="mt-12">
                <div className="font-display text-red text-xs tracking-[0.3em]">確認テスト</div>
                <h2 className="font-display text-3xl mt-1 mb-5">Did it click?</h2>
                <Quiz paperId={state.paper.id} questions={state.analysis.quiz} claims={state.analysis.claims} onClaim={onQuizClaim} />
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function ScrollChapter({
  chapter,
  seedKey,
  onPage,
  initialPage,
  state,
  total,
  onNext,
  onQuizClaim,
}: {
  chapter: Chapter;
  seedKey: string;
  onPage: (n: number) => void;
  initialPage: number;
  state: ProcessedPaper;
  total: number;
  onNext: () => void;
  onQuizClaim: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initialPage > 1) document.getElementById(`pg-${initialPage}`)?.scrollIntoView();
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) onPage(Number((vis.target as HTMLElement).dataset.page));
      },
      { threshold: [0.25, 0.5, 0.75] },
    );
    ref.current?.querySelectorAll("[data-page]").forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="max-w-[820px] mx-auto space-y-6 sm:space-y-10">
      <ChapterTitle chapter={chapter} show />
      {chapter.pages.map((pg, i) => (
        <div key={i} id={`pg-${i + 1}`} data-page={i + 1} className="ink-in">
          <MangaPageView page={pg} pageNumber={i + 1} chapterKicker={`${chapter.kicker} ${chapter.title}`} seedKey={seedKey} className="shadow-[0_30px_80px_rgba(0,0,0,0.55)]" />
        </div>
      ))}
      <div id={`pg-${chapter.pages.length + 1}`} data-page={chapter.pages.length + 1}>
        <EndCard state={state} chapter={chapter} total={total} onNext={onNext} onQuizClaim={onQuizClaim} />
      </div>
    </div>
  );
}
