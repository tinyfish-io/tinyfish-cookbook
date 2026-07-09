import React from 'react';
import { scrollToSection } from '../../lib/api';

const FOOTER_NAV = [
  { label: 'Engine', id: 'engine' },
  { label: 'Matrix', id: 'matrix' },
  { label: 'Coverage', id: 'coverage' },
];

export function ClosingCTA() {
  return (
    <section id="contact" className="w-full relative min-h-[600px] flex flex-col items-center justify-between overflow-hidden bg-fs-ink pt-32 scroll-mt-24">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#2a1b4d] to-fs-ink opacity-40" />

      <div className="absolute bottom-0 left-0 w-full h-64 overflow-hidden z-0 opacity-[0.03] pointer-events-none">
        <div className="w-full h-[200%] font-mono-fs text-[0.4rem] text-white leading-tight" style={{ animation: 'fs-marquee-y 40s linear infinite' }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i}>
              0x{Math.floor(Math.random()*1000000).toString(16).padStart(6, '0')} {Math.random().toString(36).substring(2, 15)}
              {Math.random().toString(36).substring(2, 15)} {Math.random().toString(36).substring(2, 15)}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-20 text-center px-8 flex-1 flex flex-col items-center justify-center -mt-20">
        <h4 className="font-mono-fs text-fs-gold text-[0.65rem] uppercase tracking-[0.2em] mb-6">08 — Request Access</h4>
        <h2 className="font-serif-display text-5xl md:text-[5rem] text-white tracking-tight leading-[1.05] mb-6 max-w-4xl mx-auto">
          The sun sets on manual<br/>market research in <span className="text-fs-gold italic">Vietnam</span>.
        </h2>

        <p className="font-sans-fs text-white/70 text-sm max-w-md mx-auto mb-10 leading-relaxed">
          Onboard your expansion team in under a week. We'll instrument your first vertical against live Vietnamese data, end to end.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-lg mx-auto">
          <input
            type="email"
            placeholder="work email"
            className="flex-1 bg-transparent border border-white/20 rounded-full px-6 py-3 font-mono-fs text-sm text-white focus:outline-none focus:border-fs-gold/50"
          />
          <button className="px-8 py-3.5 bg-fs-gold text-fs-ink font-mono-fs text-[0.65rem] uppercase tracking-widest font-bold rounded-full hover:bg-fs-gold-soft transition-colors whitespace-nowrap">
            Request Access
          </button>
        </div>
        <div className="mt-4 font-mono-fs text-[0.55rem] text-white/30 uppercase tracking-widest">
          Reply within 24H - UTC+7
        </div>
      </div>

      <footer className="w-full border-t border-white/5 py-8 px-8 relative z-20 bg-black/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-fs-gold" />
            <span className="font-sans-fs font-semibold tracking-wide text-sm text-white">FinSight</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-[0.55rem] uppercase tracking-[0.2em] font-bold text-white/50 font-mono-fs">
            {FOOTER_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="hover:text-white cursor-pointer transition-colors bg-transparent border-none"
              >
                {item.label}
              </button>
            ))}
            <span className="text-white/30 ml-4">Powered by TinyFish</span>
          </div>

          <div className="font-mono-fs text-[0.55rem] text-white/30 uppercase tracking-widest">
            © 2026 - Hà Nội - TP. HCM
          </div>
        </div>
      </footer>
    </section>
  );
}
