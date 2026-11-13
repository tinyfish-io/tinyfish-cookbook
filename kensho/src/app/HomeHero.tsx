"use client";

import Link from "next/link";
import type { MangaPage } from "@/lib/types";
import { MangaPageView } from "@/components/manga/MangaPage";
import { SearchBar } from "@/components/ui/chrome";
import { Character } from "@/components/manga/characters";
import { Scene } from "@/components/manga/scenes";
import { Sumi } from "@/components/mascot/Sumi";
import { Reveal } from "@/components/ui/motion";
import { useLibrary } from "@/lib/library";

// The hero page is rendered by the same engine as the reader, so what you see here is
// exactly how chapters look. Its dialogue is product copy, not research content.
const HERO_PAGE: MangaPage = {
  panels: [
    {
      kind: "dialogue",
      size: "wide",
      refs: [],
      scene: "speed",
      sfx: "DOKI",
      cast: [
        { character: "kai", expression: "surprised", pose: "shock" },
        { character: "hoshi", expression: "smug", pose: "point" },
      ],
      lines: [
        { speaker: "kai", text: "Wait… I just read a 40-page research paper?!", style: "shout", basis: "aside", refs: [] },
        { speaker: "hoshi", text: "Every paper is a story. You only needed it drawn.", style: "speech", basis: "aside", refs: [] },
      ],
    },
    {
      kind: "dialogue",
      size: "medium",
      refs: [],
      scene: "circuit",
      cast: [{ character: "sumi", expression: "excited", pose: "idle" }],
      lines: [{ speaker: "sumi", text: "I swim the web with TinyFish and fetch the real papers!", style: "speech", basis: "aside", refs: [] }],
    },
    {
      kind: "dialogue",
      size: "medium",
      refs: [],
      scene: "focus",
      cast: [{ character: "hoshi", expression: "serious", pose: "explain" }],
      lines: [{ speaker: "hoshi", text: "Every claim stays tied to the exact words in the paper.", style: "speech", basis: "aside", refs: [] }],
    },
  ],
};

const EXAMPLES = ["How do large language models work?", "How does blockchain consensus work?", "Can AI detect diseases?", "How do neural networks learn?"];

export function HomeHero() {
  return (
    <section className="relative overflow-hidden border-b-[3px] border-ink">
      <div className="absolute inset-0 tone-fade opacity-[0.07] pointer-events-none" />
      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 pt-8 sm:pt-12 pb-14 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1.08fr_1fr] gap-10 lg:gap-14 items-center">
        <div>
          <Reveal className="flex items-center gap-3 font-mono text-[11px] tracking-[0.25em]">
            <span className="bg-ink text-white px-1.5 py-0.5">00</span>
            <span>PROLOGUE</span>
            <span className="h-[2px] w-12 bg-ink" />
            <span className="text-red">研究を、漫画で読む。</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display leading-[0.95] tracking-[-0.01em] text-[clamp(34px,6.4vw,84px)] mt-5">
              What do you want
              <br />
              to <span className="inline-block bg-ink text-white px-3 -rotate-[1.5deg] shadow-[7px_7px_0_var(--red)]">understand?</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-7 text-lg sm:text-xl leading-relaxed max-w-[44ch] text-ink-2">
              Ask in plain words. Kenshō finds <strong className="text-ink">real research papers</strong> on the web, reads them, and draws them as manga chapters you
              can actually follow — every claim cited to the paper.
            </p>
          </Reveal>
          <Reveal delay={240} className="mt-8 max-w-[640px]">
            <SearchBar autoFocus />
          </Reveal>
          <Reveal delay={320} className="mt-4">
            <div className="font-mono text-[11px] text-ink-3 tracking-wider mb-2">OR TRY ONE OF THESE</div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((t) => (
                <Link
                  key={t}
                  href={`/search?q=${encodeURIComponent(t)}`}
                  className="text-sm font-bold border-2 border-ink bg-white px-2.5 py-1 hover:bg-ink hover:text-white hover:-rotate-1 transition-all"
                >
                  {t}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal variant="panel" delay={200} className="relative">
          <div className="absolute -top-6 -right-4 w-40 h-40 tone-dots-lg opacity-20 rotate-12 pointer-events-none" />
          <div className="hero-page relative rotate-[1.2deg] border-[3px] border-ink shadow-[12px_12px_0_var(--ink)] bg-white max-w-[560px] mx-auto transition-transform duration-500 hover:rotate-0">
            <MangaPageView page={HERO_PAGE} pageNumber={1} chapterKicker="第一話 · how it feels" seedKey="hero-v3" />
          </div>
          <div className="absolute -left-4 -bottom-6 hidden md:block">
            <Sumi mode="interactive" size={112} bubble="Ask me anything!" bubbleSide="right" float />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Real reading progress only — the strip doesn't render until the reader has started something. */
export function ContinueStrip() {
  const lib = useLibrary();
  const items = Object.entries(lib.progress)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
    .slice(0, 3);
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-10">
      <div className="flex items-center gap-3 mb-3">
        <span className="bg-red text-white font-display text-xs px-2 py-0.5">続き</span>
        <h2 className="font-display text-lg">Continue reading</h2>
      </div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(([id, p]) => (
          <li key={id}>
            <Link href={`/read/${id}?ch=${p.chapter}&p=${p.page}`} className="group flex items-center gap-4 border-[3px] border-ink bg-white p-3 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--ink)] transition-all">
              <span className="font-display text-2xl w-12 h-12 grid place-items-center bg-ink text-white shrink-0 group-hover:bg-red transition-colors">{p.chapter}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-snug line-clamp-1">{p.title}</span>
                <span className="mt-1.5 flex gap-1" aria-label={`Chapter ${p.chapter} of ${p.totalChapters}`}>
                  {Array.from({ length: p.totalChapters }, (_, i) => (
                    <span key={i} className={`h-1.5 flex-1 ${i + 1 < p.chapter ? "bg-ink" : i + 1 === p.chapter ? "bg-red" : "bg-ink/15"}`} />
                  ))}
                </span>
              </span>
              <span className="font-mono text-[11px] shrink-0">P.{p.page} ▸</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    {
      n: "01",
      jp: "探す",
      title: "Ask a question",
      body: "TinyFish searches research indexes and open repositories — arXiv, OpenReview, PubMed Central and more — and brings back real papers with their original links.",
      art: (
        <div className="relative h-full">
          <Scene id="circuit" seed={3} className="absolute inset-0 w-full h-full" />
          <div className="absolute left-[8%] top-[10%]">
            <Sumi mode="scouting" size={110} float />
          </div>
          <div className="absolute right-[6%] top-[14%] flex flex-col gap-1.5">
            {["arxiv.org", "openreview.net", "ncbi.nlm.nih.gov"].map((d) => (
              <span key={d} className="bg-white border-2 border-ink font-mono text-[10px] px-1.5 py-0.5">
                {d}
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      n: "02",
      jp: "読む",
      title: "Pick a paper",
      body: "Each result says whether its full text is open or only the abstract is. Kenshō reads what's openly available and never gets around paywalls.",
      art: (
        <div className="relative h-full bg-paper">
          <div className="absolute inset-0 tone-lines opacity-[0.08]" />
          <div className="absolute left-[10%] top-[16%] right-[34%] space-y-1.5">
            {[90, 76, 84, 60, 88, 70].map((w, i) => (
              <div key={i} className={`h-2 ${i === 2 ? "bg-red" : "bg-ink"}`} style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="absolute right-[-4%] bottom-0 h-[92%]">
            <Character id="hoshi" expression="thinking" pose="think" className="h-full w-auto" />
          </div>
        </div>
      ),
    },
    {
      n: "03",
      jp: "わかる",
      title: "Read it as manga",
      body: "Chapters with characters, diagrams and key terms. Analogies are marked as analogies; every research claim links to a verbatim quote from the paper.",
      art: (
        <div className="relative h-full">
          <Scene id="focus" seed={9} className="absolute inset-0 w-full h-full" />
          <div className="absolute left-[-4%] bottom-0 h-[94%]">
            <Character id="kai" expression="excited" pose="cheer" className="h-full w-auto" />
          </div>
          <span className="absolute right-[10%] top-[18%] w-20 h-20 rounded-full border-[3px] border-red text-red grid place-items-center rotate-[-8deg] bg-white">
            <span className="text-center leading-none">
              <span className="block font-display text-lg">検証</span>
              <span className="block font-mono text-[8px] mt-0.5">VERIFIED</span>
            </span>
          </span>
        </div>
      ),
    },
  ];
  const clips = ["polygon(0 0, 100% 0, 96% 100%, 0 100%)", "polygon(4% 0, 100% 0, 96% 100%, 0 100%)", "polygon(4% 0, 100% 0, 100% 100%, 0 100%)"];
  return (
    <div className="mt-8 grid md:grid-cols-3 gap-3 md:gap-1">
      {steps.map((s, i) => (
        <Reveal key={s.n} variant="panel" delay={i * 140}>
          <article className="relative bg-ink p-[3px] h-full" style={{ clipPath: clips[i] }}>
            <div className="bg-white h-full flex flex-col" style={{ clipPath: clips[i] }}>
              <div className="relative h-48 border-b-[3px] border-ink overflow-hidden">{s.art}</div>
              <div className="p-5 md:px-7 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl">{s.n}</span>
                  <span className="font-display text-red text-sm tracking-widest">{s.jp}</span>
                </div>
                <h3 className="font-display text-xl mt-2">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  );
}
