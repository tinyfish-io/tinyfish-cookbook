import React from 'react';
import { useIntelligence } from '../../context/IntelligenceContext';
import type { QueryType } from '../../lib/api';

const QUERIES: { text: string; type: QueryType }[] = [
  { text: 'Rental rates - 200m² retail - District 1 HCMC', type: 'real_estate' },
  { text: 'Highlands Coffee vs Phuc Long combo pricing in Thao Dien', type: 'competitor' },
  { text: 'Compare uncollateralized SME loan rates - VPBank vs Techcombank', type: 'sme_loan' },
  { text: 'Vietnam bank eKYC regulations 2025 SBV', type: 'regulatory' },
];

export function TinyFishPipeline() {
  const {
    isRunning,
    currentQuery,
    runQuery,
  } = useIntelligence();

  const activeQueryIndex = QUERIES.findIndex((q) => q.text === currentQuery);

  const handleChipClick = (idx: number) => {
    const item = QUERIES[idx];
    void runQuery(item.text, item.type);
  };

  return (
    <section
      id="engine"
      className="w-full py-32 px-8 bg-fs-night border-t border-white/5 relative scroll-mt-24"
    >
      <div className="absolute inset-0 gold-grid opacity-30 mask-image-bottom" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-16">
          <h4 className="font-mono-fs text-fs-gold text-xs uppercase tracking-[0.2em] mb-4">03 — The Engine</h4>
          <h2 className="font-serif-display text-4xl md:text-5xl text-white tracking-tight leading-[1.1]">
            One query. Three TinyFish stages.<br />
            <span className="text-fs-gold italic">Structured truth.</span>
          </h2>
          <p className="mt-4 max-w-2xl font-sans-fs text-sm leading-relaxed text-white/55">
            This section explains the pipeline. The full live trace appears once in the
            `Intelligence Console` below, so the same run details are not repeated twice.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-16">
          {QUERIES.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(idx)}
              disabled={isRunning}
              className={`px-5 py-2.5 rounded-full text-xs font-mono-fs transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
                activeQueryIndex === idx
                  ? 'border-fs-gold bg-fs-gold/10 text-fs-gold shadow-[0_0_15px_rgba(230,180,80,0.2)]'
                  : 'border-white/10 text-white/50 hover:text-white/80 hover:border-white/30 bg-black/40'
              }`}
            >
              {q.text}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          <StageCard
            num="01"
            title="Search"
            sub="TinyFish Search API"
            desc="Dynamic market discovery"
            bullets={[
              'Expands one business query into multiple Vietnam-specific search angles.',
              'Prioritizes local domains, operator pages, banks, regulators, and editorial coverage.',
              'Ranks results before any fetch or synthesis begins.',
            ]}
          />
          <StageCard
            num="02"
            title="Fetch"
            sub="TinyFish Fetch API"
            desc="Headless JS · anti-bot bypass"
            bullets={[
              'Fetches full page content from shortlisted sources, including JS-heavy pages when possible.',
              'Drops empty, weak, or low-signal pages before synthesis.',
              'Builds a source bundle with enough context for a desk-quality memo.',
            ]}
          />
          <StageCard
            num="03"
            title="Synthesize"
            sub="FinSight LLM Layer"
            desc="Token-efficient extraction"
            bullets={[
              'Extracts concrete facts first, then writes the memo from admissible evidence only.',
              'Separates verified metrics from gaps, caveats, and directional signals.',
              'Returns the detailed report in the console below.',
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function StageCard({
  num,
  title,
  sub,
  desc,
  bullets,
}: {
  num: string;
  title: string;
  sub: string;
  desc: string;
  bullets: string[];
}) {
  return (
    <div
      className="relative min-h-[280px] rounded-xl border border-white/10 bg-fs-ink p-8 transition-all duration-500"
    >
      <div className="absolute right-6 top-6 h-2 w-2 rounded-full bg-fs-gold/50" />

      <div className="font-mono-fs text-[0.65rem] text-white/40 mb-4">{num}</div>
      <h3 className="font-serif-display text-3xl text-white mb-1">{title}</h3>
      <div className="font-sans-fs font-semibold text-fs-gold text-[0.65rem] uppercase tracking-widest mb-1">{sub}</div>
      <div className="font-sans-fs text-white/50 text-xs mb-8 pb-6 border-b border-white/10">{desc}</div>

      <ul className="space-y-3 font-mono-fs text-[0.65rem] text-white/70">
        {bullets.map((bullet, i) => (
          <li key={i}>{bullet}</li>
        ))}
      </ul>
    </div>
  );
}
