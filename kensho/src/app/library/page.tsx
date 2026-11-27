"use client";

import Link from "next/link";
import { library, useLibrary } from "@/lib/library";
import { Footer, SiteHeader } from "@/components/ui/chrome";
import { PaperCover } from "@/components/ui/PaperCover";
import { Character } from "@/components/manga/characters";

export default function LibraryPage() {
  const lib = useLibrary();
  const reading = Object.entries(lib.progress).sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt));
  const bookmarks = Object.values(lib.bookmarks).sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-10 pb-10 space-y-16">
        <div>
          <div className="font-display text-red text-xs tracking-[0.3em]">本棚 · YOUR SHELF</div>
          <h1 className="font-display text-4xl sm:text-5xl mt-1">Library</h1>
          <p className="text-ink-3 mt-2 text-sm">Saved in this browser — no account needed.</p>
        </div>

        <Section title="Continue reading" jp="続き">
          {reading.length ? (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reading.map(([id, p]) => (
                <li key={id}>
                  <Link href={`/read/${id}?ch=${p.chapter}&p=${p.page}`} className="block ink-frame p-4 hover:shadow-[6px_6px_0_var(--ink)] hover:-translate-y-0.5 transition-all">
                    <div className="font-bold leading-snug line-clamp-2">{p.title}</div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 flex gap-1">
                        {Array.from({ length: p.totalChapters }, (_, i) => (
                          <span key={i} className={`h-2 flex-1 ${i + 1 < p.chapter ? "bg-ink" : i + 1 === p.chapter ? "bg-red" : "bg-ink/15"}`} />
                        ))}
                      </div>
                      <span className="font-mono text-xs">
                        CH.{p.chapter} · P.{p.page}
                      </span>
                    </div>
                    {lib.quiz[id] && (
                      <div className="mt-2 font-mono text-[11px] text-ink-3">
                        Quiz: {lib.quiz[id].score}/{lib.quiz[id].total}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Nothing in progress yet. Open a paper and start a chapter." />
          )}
        </Section>

        <Section title="Bookmarked papers" jp="栞">
          {bookmarks.length ? (
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
              {bookmarks.map(({ paper }) => (
                <li key={paper.id}>
                  <Link href={`/paper/${paper.id}`} className="group block">
                    <PaperCover paper={paper} size="sm" className="transition-transform group-hover:-translate-y-1" />
                  </Link>
                  <div className="mt-2 flex items-start gap-2">
                    <Link href={`/paper/${paper.id}`} className="text-sm font-bold leading-snug line-clamp-2 hover:underline flex-1">
                      {paper.title}
                    </Link>
                    <button onClick={() => library.toggleBookmark(paper)} className="text-xs underline text-ink-3 shrink-0">
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Bookmark papers from search results or a paper page to keep them here." />
          )}
        </Section>

        <Section title="Saved concepts" jp="用語">
          {lib.concepts.length ? (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lib.concepts.map((c) => (
                <li key={`${c.paperId}-${c.term}`} className="ink-frame p-4 flex flex-col">
                  <div className="flex items-start gap-2">
                    <h3 className="font-display text-lg leading-tight flex-1">{c.term}</h3>
                    <button onClick={() => library.toggleConcept(c)} className="text-xs underline text-ink-3">
                      Remove
                    </button>
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed flex-1">{c.definition}</p>
                  <Link href={`/paper/${c.paperId}`} className="mt-3 font-mono text-[11px] text-ink-3 hover:text-ink line-clamp-1">
                    from {c.paperTitle}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="While reading, tap an underlined term and save it to build a personal concept deck." />
          )}
        </Section>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, jp, children }: { title: string; jp: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-3 border-b-[3px] border-ink pb-2 mb-5">
        <span className="font-display text-red text-xs tracking-[0.3em]">{jp}</span>
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-4 border-2 border-dashed border-ink p-5">
      <div className="w-14 shrink-0">
        <Character id="sumi" expression="thinking" />
      </div>
      <p className="text-ink-2">{text}</p>
    </div>
  );
}
