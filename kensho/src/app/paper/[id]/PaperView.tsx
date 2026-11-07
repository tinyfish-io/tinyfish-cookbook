"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Paper, ProcessedPaper } from "@/lib/types";
import { api, library, useLibrary } from "@/lib/library";
import { AvailabilityBadge, PaperCover, accessInfo } from "@/components/ui/PaperCover";
import { Sumi } from "@/components/mascot/Sumi";
import { Episode, Reveal } from "@/components/ui/motion";
import { Spinner } from "@/components/ui/chrome";
import { Quiz } from "@/components/Quiz";

export function PaperView({ id }: { id: string }) {
  const [state, setState] = useState<ProcessedPaper | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAbstract, setShowAbstract] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const lib = useLibrary();

  const load = useCallback(() => {
    api<ProcessedPaper>(`/api/papers/${id}`)
      .then((s) => {
        setState(s);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const busy = !!state?.job && !["done", "error"].includes(state.job.stage);
  const finish = async () => {
    setFinishing(true);
    try {
      await api(`/api/papers/${id}/process`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFinishing(false);
    }
  };
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [busy, load]);

  if (error && !state)
    return (
      <main className="mx-auto max-w-[900px] px-4 py-20 flex flex-col items-center text-center">
        <Sumi mode="dizzy" size={140} />
        <h1 className="font-display text-2xl mt-4">{error}</h1>
        <p className="text-ink-2 mt-2">Papers open from a search. Find it again and pick it from the results.</p>
        <Link href="/search" className="btn-ink mt-6">
          FIND PAPERS
        </Link>
      </main>
    );
  if (!state)
    return (
      <main className="mx-auto max-w-[1180px] px-6 py-24">
        <Spinner label="Opening the paper…" />
      </main>
    );

  const { paper, analysis, story, acquisition, job } = state;
  const chapters = story?.chapters ?? [];
  const ready = chapters.filter(Boolean).length;
  const progress = lib.progress[id];
  const pages = chapters.reduce((n, c) => n + (c?.pages.length ?? 0), 0);
  const saved = !!lib.bookmarks[id];
  const access = accessInfo(paper);
  const failed = job?.stage === "error";

  const cta =
    ready > 0
      ? { href: `/read/${id}${progress ? `?ch=${progress.chapter}&p=${progress.page}` : ""}`, label: progress ? `CONTINUE · CHAPTER ${progress.chapter}` : "START READING" }
      : busy
        ? { href: `/read/${id}`, label: "WATCH IT BEING DRAWN" }
        : { href: `/read/${id}?start=1`, label: failed ? "TRY AGAIN" : "READ AS MANGA" };

  return (
    <main className="pb-10">
      <section className="border-b-[3px] border-ink relative overflow-hidden">
        <div className="absolute inset-0 tone-fade opacity-[0.06] pointer-events-none" />
        <div className="relative mx-auto max-w-[1180px] px-4 sm:px-6 py-8 sm:py-12 grid md:grid-cols-[280px_1fr] gap-8 lg:gap-14">
          <Reveal variant="slam" className="max-w-[240px] md:max-w-[280px] w-full mx-auto md:mx-0">
            <PaperCover paper={paper} size="lg" className="ink-shadow rotate-[-1.5deg]" />
          </Reveal>
          <div className="min-w-0">
            <Reveal className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.2em]">
              <span className="bg-ink text-white px-1.5 py-0.5">02</span>
              <span>THE PAPER</span>
              <span className="h-[2px] w-10 bg-ink" />
              <AvailabilityBadge paper={paper} />
            </Reveal>
            <Reveal delay={60}>
              <h1 className="font-display text-[clamp(26px,3.8vw,48px)] leading-[1.04] mt-4" style={{ textWrap: "balance" }}>
                {paper.title}
              </h1>
              <p className="mt-3 text-ink-2 font-medium">
                {paper.authors.length ? paper.authors.slice(0, 8).join(", ") + (paper.authors.length > 8 ? ", et al." : "") : "Authors not listed by the source"}
              </p>
              <p className="mt-1 font-mono text-xs text-ink-3">
                {[paper.venue, paper.year, paper.citedBy != null ? `${paper.citedBy.toLocaleString()} citations` : null].filter(Boolean).join(" · ")}
              </p>
            </Reveal>

            <Reveal delay={120} className="mt-6 max-w-[64ch]">
              <div className="font-display text-xs tracking-[0.25em] text-red">{analysis ? "IN ONE LINE" : paper.abstractIsSnippet ? "FROM THE SEARCH RESULT" : "ABSTRACT"}</div>
              {analysis ? (
                <p className="mt-1.5 text-xl leading-snug font-bold border-l-[5px] border-red pl-4">{analysis.oneLiner}</p>
              ) : (
                <div className="mt-1.5">
                  <p className={`text-[17px] leading-relaxed text-ink-2 ${showAbstract ? "" : "line-clamp-4"}`}>{paper.abstract ?? "The source didn’t provide an abstract."}</p>
                  {paper.abstract && paper.abstract.length > 320 && (
                    <button onClick={() => setShowAbstract((v) => !v)} className="mt-1 text-sm font-bold underline underline-offset-2">
                      {showAbstract ? "Show less" : "Read the full abstract"}
                    </button>
                  )}
                </div>
              )}
            </Reveal>

            <Reveal delay={180}>
              <dl className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-[720px]">
                <Fact label="Difficulty">
                  {analysis ? (
                    <span className="flex gap-1 mt-1" aria-label={`${analysis.difficulty} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`w-3.5 h-3.5 rounded-full border-2 border-ink ${n <= analysis.difficulty ? "bg-ink" : "bg-white"}`} />
                      ))}
                    </span>
                  ) : (
                    <span className="text-ink-3 font-normal text-sm">Rated after reading</span>
                  )}
                </Fact>
                <Fact label="Reading time">{pages ? `~${Math.max(3, Math.round(pages * 1.3))} min` : <span className="text-ink-3 font-normal text-sm">Known once drawn</span>}</Fact>
                <Fact label="Chapters">{analysis ? `${ready} of ${analysis.chapterPlan.length} drawn` : <span className="text-ink-3 font-normal text-sm">Not drawn yet</span>}</Fact>
                <Fact label="Content">{access.label}</Fact>
              </dl>
            </Reveal>

            <Reveal delay={240} className="mt-7 flex flex-wrap gap-3 items-center">
              <Link href={cta.href} className="btn-ink text-lg">
                {cta.label} ▸
              </Link>
              {failed && ready > 0 && analysis && ready < analysis.chapterPlan.length && (
                <button onClick={finish} disabled={finishing} className="btn-line">
                  {finishing ? "Starting…" : "Finish missing chapters"}
                </button>
              )}
              <button onClick={() => library.toggleBookmark(paper)} className="btn-line" aria-pressed={saved}>
                {saved ? "★ Bookmarked" : "☆ Bookmark"}
              </button>
              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="btn-line">
                Original paper ↗
              </a>
            </Reveal>
            <p className="mt-3 text-sm text-ink-3 max-w-[60ch]">
              {ready > 0
                ? `${ready} chapter${ready === 1 ? "" : "s"} ready${failed && analysis && ready < analysis.chapterPlan.length ? ` · ${analysis.chapterPlan.length - ready} couldn’t be drawn on the last attempt` : ""}.`
                : busy
                  ? "Kenshō is drawing this paper right now."
                  : failed
                    ? `Last attempt stopped: ${job?.error?.slice(0, 160)}`
                    : `${access.hint} Preparing the manga usually takes one to three minutes.`}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 grid lg:grid-cols-[1fr_320px] gap-10 lg:gap-14 pt-12">
        <div className="min-w-0 space-y-14">
          {!analysis && (
            <section>
              <Episode n={1} jp="次に · WHAT HAPPENS NEXT" title="From paper to manga" />
              <ol className="mt-6 grid sm:grid-cols-3 gap-3">
                {[
                  ["取得", "TinyFish retrieves the text", "Open full text when available; a browser agent looks for an open copy if a simple fetch isn’t enough."],
                  ["読解", "The research is understood", "Problem, method, results and limits are extracted, each tied to a quote checked against the paper."],
                  ["作画", "Chapters are drawn", "Characters, diagrams and key terms. Chapter one opens as soon as it’s ready."],
                ].map(([jp, t, d], i) => (
                  <Reveal as="li" key={jp} delay={i * 90} className="border-[3px] border-ink bg-white p-4">
                    <div className="font-display text-red text-sm">{jp}</div>
                    <div className="font-bold mt-1">{t}</div>
                    <p className="text-sm text-ink-2 mt-1 leading-snug">{d}</p>
                  </Reveal>
                ))}
              </ol>
            </section>
          )}

          {analysis && (
            <>
              <section className="grid md:grid-cols-2 gap-8">
                <Reveal>
                  <SubHead jp="問題" title="The problem" />
                  <p className="mt-3 text-[17px] leading-relaxed">{analysis.problem}</p>
                </Reveal>
                <Reveal delay={80}>
                  <SubHead jp="貢献" title="What they did" />
                  <p className="mt-3 text-[17px] leading-relaxed">{analysis.contribution}</p>
                </Reveal>
              </section>
              <section>
                <Episode n={1} jp="目次 · CONTENTS" title="Chapters" />
                <ol className="mt-6 grid gap-3">
                  {analysis.chapterPlan.map((plan, i) => {
                    const ch = chapters[i];
                    return (
                      <Reveal as="li" key={plan.number} delay={i * 60}>
                        <ChapterRow id={id} n={plan.number} title={ch?.title ?? plan.title} kicker={ch?.kicker} summary={ch?.summary || plan.focus} ready={!!ch} pages={ch?.pages.length} current={progress?.chapter === plan.number} drawing={busy} />
                      </Reveal>
                    );
                  })}
                </ol>
              </section>
              {analysis.quiz.length > 0 && ready > 0 && (
                <section id="quiz">
                  <Episode n={2} jp="確認 · CHECK" title="Test your understanding" sub="Every answer is backed by a claim from the paper." />
                  <div className="mt-6">
                    <Quiz paperId={id} questions={analysis.quiz} claims={analysis.claims} onClaim={(c) => (window.location.href = `/read/${id}?claim=${c}`)} />
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <aside className="space-y-9 lg:sticky lg:top-24 self-start">
          {analysis && analysis.prerequisites.length > 0 && (
            <div>
              <h3 className="font-display text-sm tracking-widest border-b-[3px] border-ink pb-2">BEFORE YOU READ</h3>
              <ul className="mt-3 space-y-2.5">
                {analysis.prerequisites.map((p) => (
                  <li key={p.concept} className="border-2 border-ink bg-white p-3">
                    <div className="font-bold">{p.concept}</div>
                    <div className="text-sm text-ink-2 mt-1 leading-snug">{p.why}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {acquisition && (
            <details className="group">
              <summary className="font-display text-sm tracking-widest border-b-[3px] border-ink pb-2 cursor-pointer list-none flex items-center">
                SOURCE TRAIL <span className="ml-auto font-mono text-xs group-open:rotate-45 transition-transform">+</span>
              </summary>
              <ul className="mt-3 space-y-1.5 font-mono text-xs text-ink-2">
                <li>
                  Read from:{" "}
                  <a className="underline break-all" href={acquisition.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {acquisition.sourceUrl}
                  </a>
                </li>
                <li>Steps: {acquisition.via.join(" → ")}</li>
                <li>
                  {acquisition.sections.length} sections · {Math.round(acquisition.chars / 1000)}k chars
                </li>
                {analysis && (
                  <li>
                    {analysis.claims.filter((c) => c.verified).length}/{analysis.claims.length} quotes verified
                  </li>
                )}
                {acquisition.notes.map((n, i) => (
                  <li key={i} className="text-ink-3">
                    · {n}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Related id={id} />
        </aside>
      </div>
    </main>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-ink bg-white px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className="font-bold mt-0.5">{children}</dd>
    </div>
  );
}

function SubHead({ jp, title }: { jp: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b-[3px] border-ink pb-2">
      <span className="font-display text-red text-xs tracking-[0.3em]">{jp}</span>
      <h2 className="font-display text-2xl">{title}</h2>
    </div>
  );
}

function ChapterRow(p: { id: string; n: number; title: string; kicker?: string; summary: string; ready: boolean; pages?: number; current: boolean; drawing: boolean }) {
  const inner = (
    <div className={`group flex items-center gap-4 border-[3px] border-ink p-4 transition-all ${p.ready ? "bg-white hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--ink)]" : "bg-paper-2 border-dashed"}`}>
      <span className={`font-display text-2xl w-12 h-12 grid place-items-center shrink-0 transition-colors ${p.ready ? "bg-ink text-white group-hover:bg-red" : "bg-white text-ink-3 border-2 border-ink/40"}`}>{p.n}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          {p.kicker && <span className="font-display text-red text-xs">{p.kicker}</span>}
          <span className="font-display text-lg leading-tight">{p.title}</span>
          {p.current && <span className="bg-red text-white text-[10px] font-black px-1.5 py-0.5 tracking-wider">READING</span>}
        </div>
        <p className="text-sm text-ink-2 mt-0.5 line-clamp-2">{p.summary}</p>
      </div>
      <span className="font-mono text-xs text-ink-3 shrink-0 text-right">{p.ready ? `${p.pages} pages ▸` : p.drawing ? <Spinner label="inking" /> : "not drawn"}</span>
    </div>
  );
  return p.ready ? <Link href={`/read/${p.id}?ch=${p.n}`}>{inner}</Link> : inner;
}

function Related({ id }: { id: string }) {
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api<{ papers: Paper[] }>(`/api/papers/${id}/related`)
      .then((r) => setPapers(r.papers))
      .catch(() => setErr(true));
  }, [id]);
  return (
    <div>
      <h3 className="font-display text-sm tracking-widest border-b-[3px] border-ink pb-2 flex items-center">
        RELATED RESEARCH <span className="ml-auto font-mono text-[10px] text-ink-3 tracking-normal">via TinyFish</span>
      </h3>
      {!papers && !err && (
        <div className="mt-3">
          <Spinner label="Searching related papers…" />
        </div>
      )}
      {err && <p className="mt-3 text-sm text-ink-3">Related papers couldn’t be loaded right now.</p>}
      {papers && papers.length === 0 && <p className="mt-3 text-sm text-ink-3">No closely related papers found.</p>}
      <ul className="mt-3 space-y-3">
        {papers?.map((p) => (
          <li key={p.id}>
            <Link href={`/paper/${p.id}`} className="flex gap-3 group">
              <div className="w-12 shrink-0">
                <PaperCover paper={p} size="sm" className="!border-2" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm leading-snug group-hover:underline line-clamp-3">{p.title}</div>
                <div className="text-xs text-ink-3 mt-0.5">
                  {p.authors[0] ?? ""}
                  {p.year ? ` · ${p.year}` : ""}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
