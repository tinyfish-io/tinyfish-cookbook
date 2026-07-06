import React, { useState } from 'react';
import { Search, ChevronRight, Activity, ShieldCheck } from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';
import { DRAWER_QUERY_TYPES, scrollToSection } from '../../lib/api';
import { IntelligenceReport } from './IntelligenceReport';

const MATRIX_DRAWERS = [
  {
    id: 'market-intel',
    num: '01',
    title: 'Market Intel',
    sub: 'Competitor pricing · density · share-of-voice',
    icon: Search,
    queries: [
      'Highlands Coffee vs Phuc Long combo pricing in Thao Dien',
      'Top bubble tea brands by storefront density in District 1 HCMC',
    ],
    output: `{
  "category": "f&b - bubble_tea",
  "district": "d1, HCMC",
  "leader": "Phuc Long",
  "storefronts": 47,
  "avg_combo_vnd": 65000,
  "delta_yoy": "+4.2%"
}`,
  },
  {
    id: 'sme-finance',
    num: '02',
    title: 'SME Finance',
    sub: 'Lending rates · collateral comps · cashflow benchmarks',
    icon: Activity,
    queries: [
      'Compare uncollateralized SME loan rates - VPBank vs Techcombank',
      'Collateral-backed SME loan rates - Vietcombank vs BIDV',
    ],
    output: `{
  "segment": "sme_uncollateralized",
  "vpbank_rate": "12.5%",
  "tcb_rate": "11.8%",
  "approval_sla_days": 3,
  "trend": "downward"
}`,
  },
  {
    id: 'regulatory',
    num: '03',
    title: 'Regulatory Compliance',
    sub: 'Foreign ownership · licensing · zoning · tax updates',
    icon: ShieldCheck,
    queries: [
      'New SBV circulars on foreign capital injection limits - Fintech',
      'Vietnam bank eKYC regulations 2025 SBV',
    ],
    output: `{
  "sector": "fintech_fdi",
  "regulator": "SBV",
  "latest_circular": "Cir 15/2026",
  "foreign_cap": "49%",
  "status": "enacted"
}`,
  },
];

export function QueryMatrix() {
  const [openDrawer, setOpenDrawer] = useState<string>('market-intel');
  const { lastResponse, currentQueryType, runQuery } = useIntelligence();

  const handleSampleClick = (e: React.MouseEvent, drawerId: string, query: string) => {
    e.stopPropagation();
    const queryType = DRAWER_QUERY_TYPES[drawerId];
    void runQuery(query, queryType);
    scrollToSection('analysis-console');
  };

  const getLiveResult = (drawerId: string) => {
    const drawerType = DRAWER_QUERY_TYPES[drawerId];
    if (
      lastResponse &&
      currentQueryType === drawerType &&
      lastResponse.results[0]
    ) {
      return lastResponse.results[0];
    }
    return null;
  };

  return (
    <section
      id="matrix"
      className="w-full py-32 px-8 bg-fs-night border-t border-white/5 relative scroll-mt-24"
    >
      <div className="absolute inset-0 gold-grid opacity-20 mask-image-bottom" />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <h4 className="font-mono-fs text-fs-gold text-xs uppercase tracking-[0.2em] mb-4">04 — The Matrix</h4>
            <h2 className="font-serif-display text-4xl md:text-5xl text-white tracking-tight leading-[1.1]">
              Three drawers. <span className="text-fs-gold italic">One filing cabinet.</span>
            </h2>
          </div>
          <p className="font-sans-fs text-white/60 text-sm max-w-xs md:text-right">
            Click a sample query to run it live. Results appear here and in the analysis console.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {MATRIX_DRAWERS.map((drawer) => {
            const isOpen = openDrawer === drawer.id;
            const liveResult = getLiveResult(drawer.id);
            const isLive = !!liveResult;
            const sampleOutput =
              MATRIX_DRAWERS.find((d) => d.id === drawer.id)?.output ?? '';

            return (
              <div
                key={drawer.id}
                className={`border rounded-xl transition-all duration-300 overflow-hidden cursor-pointer
                  ${isOpen ? 'border-fs-gold bg-fs-ink shadow-[0_0_20px_rgba(230,180,80,0.1)]' : 'border-white/10 bg-black/20 hover:border-white/30'}
                `}
                onClick={() => setOpenDrawer(drawer.id)}
              >
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <span className={`font-mono-fs text-xs ${isOpen ? 'text-fs-gold' : 'text-white/40'}`}>{drawer.num}</span>
                    <div>
                      <h3 className={`font-serif-display text-3xl mb-1 ${isOpen ? 'text-white' : 'text-white/80'}`}>{drawer.title}</h3>
                      <p className="font-sans-fs text-white/50 text-xs tracking-wider uppercase">{drawer.sub}</p>
                    </div>
                  </div>
                  <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-90 text-fs-gold' : 'text-white/30'}`}>
                    <ChevronRight size={20} />
                  </div>
                </div>

                <div className={`transition-all duration-500 ease-in-out px-6 ${isOpen ? 'max-h-[800px] pb-6 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                      <div className="font-mono-fs text-fs-gold text-[0.65rem] uppercase tracking-widest">Sample Queries</div>
                      {drawer.queries.map((q, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => handleSampleClick(e, drawer.id, q)}
                          className="w-full text-left px-4 py-3 border border-white/10 rounded-md bg-black/40 font-sans-fs text-sm text-white/80 flex items-center gap-3 hover:border-fs-gold/50 hover:bg-fs-gold/5 transition-colors"
                        >
                          <ChevronRight size={14} className="text-fs-gold shrink-0" />
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 space-y-4 min-w-0">
                      <div className="font-mono-fs text-fs-gold text-[0.65rem] uppercase tracking-widest">
                        {isLive ? 'Live Report' : 'Sample Output'}
                      </div>
                      {isLive && liveResult ? (
                        <IntelligenceReport
                          result={liveResult}
                          queryType={currentQueryType}
                          status={lastResponse?.status ?? 'success'}
                          dataQuality={lastResponse?.data_quality}
                          compact
                        />
                      ) : (
                        <div className="p-4 rounded-md bg-black border border-white/10 font-mono-fs text-xs text-fs-gold-soft overflow-x-auto">
                          <pre><code>{sampleOutput}</code></pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
