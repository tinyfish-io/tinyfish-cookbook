"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Paper, SearchResponse } from "@/lib/types";
import { library, useLibrary } from "@/lib/library";
import { SearchBar } from "@/components/ui/chrome";
import { AvailabilityBadge, PaperCover, accessInfo } from "@/components/ui/PaperCover";
import { Sumi } from "@/components/mascot/Sumi";
import { Reveal } from "@/components/ui/motion";

type Sort = "relevance" | "cited" | "newest";
type SourceState = { label: string; status: "pending" | "ok" | "failed"; count: number; error?: string };

/** Streams real discovery progress from /api/search?stream=1. */
function useDiscovery(q: string) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!q);
  const [sources, setSources] = useState<SourceState[]>([]);
  const [stage, setStage] = useState<string>("Asking TinyFish to search the research web");
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(
    async (fresh = false) => {
      if (!q) return;
      abort.current?.abort();
      const ctrl = (abort.current = new AbortController());
      setLoading(true);
      setError(null);
      setSources([]);
      setStage("Asking TinyFish to search the research web");
      try {
        const res = await fetch(`/api/search?stream=1&q=${encodeURIComponent(q)}${fresh ? "&fresh=1" : ""}`, { signal: ctrl.signal });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `Search failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line) continue;
            const ev = JSON.parse(line);
            if (ev.type === "start") setSources(ev.sources.map((label: string) => ({ label, status: "pending", count: 0 })));
            if (ev.type === "source")
              setSources((s) => s.map((x) => (x.label === ev.label ? { ...x, status: ev.ok ? "ok" : "failed", count: ev.count, error: ev.error } : x)));
            if (ev.type === "stage") setStage(ev.text);
            if (ev.type === "result") setData(ev.data);
            if (ev.type === "error") throw new Error(ev.error);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [q],
  );

  useEffect(() => {
    run();
    return () => abort.current?.abort();
  }, [run]);

  return { data, error, loading, sources, stage, run };
}

export function SearchView({ q }: { q: string }) {
  const { data, error, loading, sources, stage, run } = useDiscovery(q);
  const [sort, setSort] = useState<Sort>("relevance");
  const [openOnly, setOpenOnly] = useState(false);
  const lib = useLibrary();

  const papers = useMemo(() => {
    if (!data) return [];
    let list = data.papers.map((p, i) => ({ p, i }));
    if (openOnly) list = list.filter(({ p }) => p.availability === "full_text");
    if (sort === "cited") list.sort((a, b) => (b.p.citedBy ?? -1) - (a.p.citedBy ?? -1));
    if (sort === "newest") list.sort((a, b) => (b.p.year ?? 0) - (a.p.year ?? 0));
    return list.map(({ p }) => p);
  }, [data, sort, openOnly]);

  const openCount = data?.papers.filter((p) => p.availability === "full_text").length ?? 0;
  const [best, ...rest] = papers;

  return (
    <main className="mx-auto max-w-[1180px] px-4 sm:px-6 pb-24">
      <div className="pt-8 sm:pt-10 max-w-[780px]">
        <SearchBar initial={q} size="md" />
      </div>

      {!q && (
        <Reveal className="mt-10 ink-frame p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <Sumi mode="interactive" size={130} />
          <div>
            <h1 className="font-display text-2xl">What are you curious about?</h1>
            <p className="text-lg text-ink-2 mt-2">Ask a question in plain words — a field, a “how does…”, or a paper title. TinyFish searches research indexes and open repositories for real papers.</p>
          </div>
        </Reveal>
      )}

      {q && (
        <header className="mt-8 border-b-[3px] border-ink pb-4">
          <div className="font-display text-red text-xs tracking-[0.3em]">発見 · DISCOVERY</div>
          <h1 className="font-display text-[clamp(26px,4.2vw,46px)] leading-[1.05] mt-1 max-w-[28ch]" style={{ textWrap: "balance" }}>
            “{q}”
          </h1>
        </header>
      )}

      {/* ── live discovery ── */}
      {loading && (
        <section className="mt-10 grid md:grid-cols-[auto_1fr] gap-8 items-start" role="status" aria-live="polite">
          <Sumi mode="scouting" size={150} />
          <div className="min-w-0">
            <div className="font-display text-2xl">Searching the research web…</div>
            <p className="mt-1 text-ink-2">{stage}.</p>
            <ol className="mt-5 space-y-2 max-w-[560px]">
              {(sources.length ? sources : [{ label: "Connecting to TinyFish", status: "pending" as const, count: 0 }]).map((s) => (
                <li key={s.label} className={`flex items-center gap-3 border-2 px-3 py-2 bg-white transition-colors ${s.status === "ok" ? "border-ink" : s.status === "failed" ? "border-red" : "border-ink/25"}`}>
                  <span
                    className={`w-5 h-5 grid place-items-center text-[11px] font-black shrink-0 ${s.status === "ok" ? "bg-ink text-white" : s.status === "failed" ? "bg-red text-white" : "border-2 border-ink/40 border-t-transparent rounded-full animate-spin"}`}
                    aria-hidden
                  >
                    {s.status === "ok" ? "✓" : s.status === "failed" ? "!" : ""}
                  </span>
                  <span className="font-mono text-xs flex-1">{s.label}</span>
                  <span className="font-mono text-xs text-ink-3">{s.status === "ok" ? `${s.count} papers` : s.status === "failed" ? "unavailable" : "searching…"}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 grid grid-cols-4 sm:grid-cols-6 gap-3 max-w-[560px]" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={`aspect-[3/4.2] border-[3px] border-ink bg-white relative overflow-hidden ${i > 3 ? "hidden sm:block" : ""}`}>
                  <div className="absolute inset-0 tone-dots opacity-20 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {error && !loading && (
        <section className="mt-10 ink-frame p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6" role="alert">
          <Sumi mode="dizzy" size={130} />
          <div>
            <h2 className="font-display text-xl">The search came back empty-handed.</h2>
            <p className="mt-2 text-ink-2">{error}</p>
            <button className="btn-ink mt-5" onClick={() => run(true)}>
              TRY AGAIN
            </button>
          </div>
        </section>
      )}

      {/* ── results ── */}
      {data && !loading && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="text-[15px]">
              <strong>{data.papers.length} papers</strong> found · <strong>{openCount}</strong> with an open PDF link
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setOpenOnly((v) => !v)}
                aria-pressed={openOnly}
                className={`text-sm font-bold border-2 border-ink px-3 py-1.5 transition-colors ${openOnly ? "bg-ink text-white" : "bg-white hover:bg-paper-2"}`}
              >
                {openOnly ? "✓ " : ""}Open PDF only
              </button>
              <label className="inline-flex items-center border-2 border-ink bg-white">
                <span className="sr-only">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent font-bold text-sm px-2 py-1.5 outline-none cursor-pointer">
                  <option value="relevance">Best match</option>
                  <option value="cited">Most cited</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>
          </div>
          <SourceStrip data={data} onRefresh={() => run(true)} />
          <AccessLegend />

          {papers.length === 0 ? (
            <div className="mt-10 ink-frame p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
              <Sumi mode="sleepy" size={120} />
              <div>
                <h2 className="font-display text-xl">{data.papers.length ? "No open PDFs in these results." : "No papers matched."}</h2>
                <p className="mt-2 text-ink-2">
                  {data.papers.length ? "Turn off “Open PDF only” — abstract-only papers can still be read as a shorter manga." : "Try a broader phrasing, or name the field (e.g. “neural networks for protein folding”)."}
                </p>
                {openOnly && (
                  <button className="btn-line mt-4" onClick={() => setOpenOnly(false)}>
                    Show all results
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {best && <BestMatch paper={best} saved={!!lib.bookmarks[best.id]} label={sort === "relevance" ? "BEST MATCH" : sort === "cited" ? "MOST CITED" : "NEWEST"} />}
              <ol className="mt-8 grid gap-4" start={2}>
                {rest.map((p, i) => (
                  <ResultRow key={p.id} paper={p} index={i + 2} saved={!!lib.bookmarks[p.id]} />
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </main>
  );
}

function SourceStrip({ data, onRefresh }: { data: SearchResponse; onRefresh: () => void }) {
  const failed = data.sources.filter((s) => !s.ok);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-mono text-ink-3">
      <span className="bg-ink text-white px-1.5 py-0.5 font-sans font-black tracking-wider">TINYFISH</span>
      {data.sources.map((s) => (
        <span key={s.label} className={s.ok ? "" : "text-red"} title={s.error}>
          {s.label}: {s.ok ? s.count : "failed"}
        </span>
      ))}
      <span>
        {data.dedupedFrom} results → {data.papers.length} unique
      </span>
      {data.cached && (
        <button onClick={onRefresh} className="underline hover:text-ink">
          searched earlier · refresh
        </button>
      )}
      {failed.length > 0 && <span className="text-red">Some sources failed; results may be incomplete.</span>}
    </div>
  );
}

function AccessLegend() {
  return (
    <details className="mt-3 text-sm group">
      <summary className="cursor-pointer font-bold inline-flex items-center gap-1.5 select-none list-none">
        <span className="w-4 h-4 grid place-items-center border-2 border-ink text-[10px] group-open:bg-ink group-open:text-white">?</span>
        What do the access labels mean?
      </summary>
      <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 max-w-[820px] text-[13px]">
        {(
          [
            ["full_text", false],
            ["abstract_only", false],
            ["full_text", true],
            ["abstract_only", true],
          ] as const
        ).map(([availability, confirmed]) => {
          const a = accessInfo({ availability, availabilityConfirmed: confirmed } as Paper);
          return (
            <div key={a.label} className="flex gap-2 items-start">
              <dt className="shrink-0">
                <span className={`inline-flex items-center gap-1 border-2 border-ink px-1.5 py-0.5 text-[10px] font-black tracking-wider uppercase ${a.cls}`}>
                  {a.icon} {a.label}
                </span>
              </dt>
              <dd className="text-ink-2 leading-snug">{a.hint}</dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

function BookmarkButton({ paper, saved }: { paper: Paper; saved: boolean }) {
  return (
    <button
      onClick={() => library.toggleBookmark(paper)}
      className={`w-9 h-9 grid place-items-center border-2 border-ink shrink-0 transition-colors ${saved ? "bg-ink text-white" : "bg-white hover:bg-paper-2"}`}
      aria-pressed={saved}
      aria-label={saved ? "Remove bookmark" : "Bookmark paper"}
      title={saved ? "Bookmarked" : "Bookmark"}
    >
      <svg width="12" height="15" viewBox="0 0 12 15" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M1 1 H11 V14 L6 10 L1 14 Z" />
      </svg>
    </button>
  );
}

function Meta({ paper }: { paper: Paper }) {
  return (
    <div className="text-sm text-ink-3">
      {paper.authors.slice(0, 3).join(", ") || "Authors not listed"}
      {paper.authors.length > 3 ? " et al." : ""}
      {paper.year ? ` · ${paper.year}` : ""}
      {paper.venue ? ` · ${paper.venue}` : ""}
      {paper.citedBy != null ? ` · ${paper.citedBy.toLocaleString()} citations` : ""}
    </div>
  );
}

function BestMatch({ paper, saved, label }: { paper: Paper; saved: boolean; label: string }) {
  return (
    <Reveal variant="panel" className="mt-8">
      <article className="ink-frame ink-shadow grid sm:grid-cols-[200px_1fr] gap-0 overflow-hidden">
        <Link href={`/paper/${paper.id}`} className="block overflow-hidden border-b-[3px] sm:border-b-0 sm:border-r-[3px] border-ink" tabIndex={-1} aria-hidden>
          <PaperCover paper={paper} className="!border-0 w-full" />
        </Link>
        <div className="p-5 sm:p-7 flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-red text-white font-display text-[10px] tracking-[0.2em] px-2 py-0.5">{label}</span>
            <AvailabilityBadge paper={paper} />
          </div>
          <h2 className="font-display text-[clamp(20px,2.4vw,30px)] leading-[1.1] mt-3">
            <Link href={`/paper/${paper.id}`} className="hover:underline decoration-[3px] underline-offset-4">
              {paper.title}
            </Link>
          </h2>
          <div className="mt-2">
            <Meta paper={paper} />
          </div>
          {paper.abstract && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2 line-clamp-4 max-w-[70ch]">
              {paper.abstractIsSnippet && <span className="font-mono text-[10px] uppercase mr-1.5 bg-paper-2 px-1">search snippet</span>}
              {paper.abstract}
            </p>
          )}
          <div className="mt-auto pt-5 flex items-center gap-3">
            <Link href={`/paper/${paper.id}`} className="btn-ink">
              OPEN PAPER ▸
            </Link>
            <BookmarkButton paper={paper} saved={saved} />
          </div>
        </div>
      </article>
    </Reveal>
  );
}

function ResultRow({ paper, index, saved }: { paper: Paper; index: number; saved: boolean }) {
  return (
    <Reveal as="li" delay={Math.min(index, 8) * 40}>
      <article className="group grid grid-cols-[64px_1fr] sm:grid-cols-[84px_1fr_auto] gap-4 items-start border-[3px] border-ink bg-white p-3 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--ink)]">
        <Link href={`/paper/${paper.id}`} tabIndex={-1} aria-hidden className="block">
          <PaperCover paper={paper} size="sm" className="!border-2 transition-transform group-hover:-rotate-2" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-ink-3">{String(index).padStart(2, "0")}</span>
            <AvailabilityBadge paper={paper} />
          </div>
          <h3 className="font-bold text-[17px] leading-snug mt-1.5">
            <Link href={`/paper/${paper.id}`} className="hover:underline decoration-2 underline-offset-2">
              {paper.title}
            </Link>
          </h3>
          <div className="mt-1">
            <Meta paper={paper} />
          </div>
          {paper.abstract && <p className="mt-2 text-sm leading-relaxed text-ink-2 line-clamp-2 max-w-[80ch]">{paper.abstract}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 flex sm:flex-col items-center sm:items-end gap-2 justify-end">
          <Link href={`/paper/${paper.id}`} className="btn-line text-sm whitespace-nowrap">
            Open ▸
          </Link>
          <BookmarkButton paper={paper} saved={saved} />
        </div>
      </article>
    </Reveal>
  );
}
