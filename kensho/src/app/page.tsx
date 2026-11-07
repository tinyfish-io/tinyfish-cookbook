import Link from "next/link";
import { Footer, SiteHeader } from "@/components/ui/chrome";
import { PaperCover } from "@/components/ui/PaperCover";
import { Scene } from "@/components/manga/scenes";
import { Sumi } from "@/components/mascot/Sumi";
import { Episode, Reveal, Ribbon } from "@/components/ui/motion";
import { Opening } from "@/components/opening/Opening";
import { recentSearches, recentlyDrawn } from "@/server/db";
import type { SceneId } from "@/lib/types";
import { ContinueStrip, HomeHero, HowItWorks } from "./HomeHero";

export const dynamic = "force-dynamic";

const FEATURED: { topic: string; jp: string; scene: SceneId }[] = [
  { topic: "How do large language models work?", jp: "言語モデル", scene: "circuit" },
  { topic: "Quantum error correction", jp: "量子計算", scene: "space" },
  { topic: "CRISPR gene editing", jp: "遺伝子編集", scene: "cells" },
  { topic: "How do neural networks learn?", jp: "神経回路網", scene: "speed" },
  { topic: "Diffusion models for image generation", jp: "拡散モデル", scene: "sparkle" },
  { topic: "Adversarial attacks on machine learning", jp: "敵対的攻撃", scene: "storm" },
  { topic: "Can AI detect diseases from medical images?", jp: "医療画像", scene: "lab" },
  { topic: "How does blockchain consensus work?", jp: "合意形成", scene: "grid" },
];

export default function Home() {
  const searches = recentSearches(8);
  const drawn = recentlyDrawn(6);

  return (
    <>
      <Opening />
      <SiteHeader step="discover" />
      <main>
        <HomeHero />
        <ContinueStrip />

        <Ribbon text="第一話 · HOW IT WORKS · 探す · 読む · わかる" />
        <section className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-6" aria-labelledby="ep-how">
          <Episode n={1} jp="第一話 · EPISODE 1" title="How it works" sub="Three steps from a question to a chapter you understand." id="ep-how" />
          <HowItWorks />
        </section>

        <Ribbon text="第二話 · ON THE SHELF · 本棚" tone="red" tilt={1.5} />
        <section className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-6" aria-labelledby="ep-shelf">
          <Episode
            n={2}
            jp="第二話 · EPISODE 2"
            title="On the shelf"
            sub="Manga already drawn from real papers on this Kenshō."
            id="ep-shelf"
            aside={
              <Link href="/library" className="btn-line text-sm">
                Your library →
              </Link>
            }
          />
          {drawn.length === 0 && searches.length === 0 ? (
            <Reveal className="mt-8 ink-frame p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
              <Sumi mode="sleepy" size={120} />
              <div>
                <p className="text-lg font-bold">The shelf is empty — nothing has been drawn here yet.</p>
                <p className="text-ink-2 mt-1">Ask a question above, pick a paper, and its manga will appear here for everyone on this instance.</p>
              </div>
            </Reveal>
          ) : (
            <div className="mt-8 grid lg:grid-cols-[1fr_300px] gap-10">
              {drawn.length > 0 ? (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  {drawn.map(({ paper, chapters }, i) => (
                    <Reveal as="li" key={paper.id} delay={i * 70}>
                      <Link href={`/paper/${paper.id}`} className="group block">
                        <PaperCover paper={paper} size="sm" className="transition-all duration-300 group-hover:-translate-y-1.5 group-hover:-rotate-1 group-hover:shadow-[8px_8px_0_var(--ink)]" />
                        <div className="mt-2 font-bold text-sm leading-snug line-clamp-2 group-hover:underline">{paper.title}</div>
                        <div className="mt-1 font-mono text-[11px] text-ink-3">
                          {chapters} chapter{chapters === 1 ? "" : "s"} · ready to read
                        </div>
                      </Link>
                    </Reveal>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-3">No manga drawn yet — pick a paper from a search to draw the first one.</p>
              )}
              {searches.length > 0 && (
                <div>
                  <h3 className="font-display text-sm tracking-widest mb-3">RECENTLY EXPLORED</h3>
                  <ul className="flex flex-col">
                    {searches.map((s) => (
                      <li key={s.query}>
                        <Link href={`/search?q=${encodeURIComponent(s.query)}`} className="flex items-baseline gap-2 py-2 border-b-2 border-ink/15 hover:border-ink group">
                          <span className="font-bold group-hover:underline">{s.query}</span>
                          <span className="ml-auto font-mono text-[11px] text-ink-3 shrink-0">{s.count} papers</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <Ribbon text="第三話 · START WITH A TOPIC · 特集" tilt={-1.5} />
        <section className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-6" aria-labelledby="ep-topics">
          <Episode n={3} jp="第三話 · EPISODE 3" title="Start with a topic" sub="Not sure what to ask? Open one of these." id="ep-topics" />
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            {FEATURED.map((f, i) => (
              <Reveal key={f.topic} delay={(i % 4) * 70} className={i === 0 || i === 5 ? "md:col-span-2" : ""}>
                <Link href={`/search?q=${encodeURIComponent(f.topic)}`} className="group relative block overflow-hidden border-[3px] border-ink bg-white h-40 sm:h-44">
                  <Scene id={f.scene} seed={i + 4} className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-white/75 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="font-display text-red text-[11px] tracking-[0.2em]">{f.jp}</div>
                    <div className="font-display text-base sm:text-lg leading-tight mt-0.5 group-hover:underline decoration-[3px] underline-offset-4">{f.topic}</div>
                  </div>
                  <span className="absolute top-2 right-2 bg-ink text-white font-display text-[10px] px-1.5 py-0.5 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                    SEARCH ▸
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <Ribbon text="第四話 · GROUNDED, NOT MADE UP · 引用" tone="paper" tilt={1.2} />
        <section className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-6" aria-labelledby="ep-grounded">
          <Episode n={4} jp="第四話 · EPISODE 4" title="Grounded, not made up" id="ep-grounded" />
          <div className="mt-8 grid lg:grid-cols-[1fr_1.1fr] gap-8 items-center">
            <Reveal className="space-y-4 text-[17px] leading-relaxed text-ink-2 max-w-[56ch]">
              <p>
                Kenshō separates <strong className="text-ink">what the paper says</strong> from <strong className="text-ink">how we explain it</strong>. Research claims carry
                citation chips that open the exact sentence from the paper; analogies wear a <span className="font-black text-ink">喩 ANALOGY</span> tag.
              </p>
              <p>
                Every quote is checked against the text that was actually retrieved. Matches earn a red <span className="text-red font-black">検証</span> stamp; anything that
                couldn’t be matched is shown as unverified. Chart numbers must appear in a verified quote, or the chart isn’t drawn.
              </p>
            </Reveal>
            <Reveal variant="slam" delay={120}>
              <figure>
                <div className="ink-frame ink-shadow p-6 bg-paper relative overflow-hidden">
                  <div className="absolute inset-0 tone-lines opacity-[0.06]" />
                  <div className="relative flex items-center gap-2">
                    <span className="bg-ink text-white font-display text-[10px] tracking-[0.2em] px-2 py-0.5">論文より · FROM THE PAPER</span>
                    <span className="font-mono text-[11px] text-ink-3">S2 · Abstract</span>
                  </div>
                  <blockquote className="relative mt-4 font-serif text-xl leading-snug pr-24">
                    <span className="font-display text-5xl leading-none absolute -left-1 -top-3">“</span>
                    <span className="pl-7 block">We propose a new simple network architecture, the Transformer, based solely on attention mechanisms…</span>
                  </blockquote>
                  <p className="relative mt-4 border-l-[3px] border-ink pl-3 text-[15px]">
                    <strong>In plain words:</strong> the authors replace recurrence entirely with attention.
                  </p>
                  <span className="absolute right-6 top-14 w-20 h-20 rounded-full border-[3px] border-red text-red grid place-items-center rotate-[-8deg] stamp-in">
                    <span className="text-center leading-none">
                      <span className="block font-display text-lg">検証</span>
                      <span className="block font-mono text-[8px] mt-0.5">VERIFIED</span>
                    </span>
                  </span>
                </div>
                <figcaption className="mt-3 font-mono text-xs text-ink-3">How a claim panel looks · quote from Vaswani et al., “Attention Is All You Need” (2017), arXiv:1706.03762</figcaption>
              </figure>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
