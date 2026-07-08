import React from 'react';
import { FooterSkyline } from '../SkylineSilhouette';
import { scrollToSection } from '../../lib/api';

const NAV_ITEMS = [
  { label: 'Engine', id: 'engine' },
  { label: 'Matrix', id: 'matrix' },
  { label: 'Coverage', id: 'coverage' },
];

export function SkyHero() {
  return (
    <div className="relative w-full h-[90vh] min-h-[600px] overflow-hidden flex flex-col items-center justify-center pt-20">
      <div
        className="absolute inset-0 z-0"
        style={{ animation: 'fs-sky 40s linear infinite' }}
      />

      <div
        className="absolute inset-0 z-0 opacity-0"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 20px 30px, white, rgba(0,0,0,0)), radial-gradient(1px 1px at 40px 70px, white, rgba(0,0,0,0)), radial-gradient(1px 1px at 50px 160px, white, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 90px 40px, white, rgba(0,0,0,0)), radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.8), rgba(0,0,0,0)), radial-gradient(1px 1px at 160px 120px, white, rgba(0,0,0,0))',
          backgroundSize: '200px 200px',
          animation: 'fs-stars 40s linear infinite',
        }}
      />

      <div className="absolute inset-0 z-0 overflow-hidden flex justify-center items-end pb-32">
        <div
          className="w-[400px] h-[400px] rounded-full"
          style={{
            background: 'linear-gradient(180deg, #FFD166 0%, #EF476F 100%)',
            boxShadow: '0 0 120px 40px rgba(239, 71, 111, 0.5)',
            animation: 'fs-orb 40s linear infinite',
            position: 'absolute',
            bottom: '-100px',
            left: '50%',
            marginLeft: '-200px',
            opacity: 0.95,
          }}
        />
      </div>

      <nav className="absolute top-0 w-full px-8 py-6 flex justify-between items-center z-20 text-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-fs-gold" />
          <span className="font-sans-fs font-semibold tracking-wide text-fs-gold">FinSight</span>
        </div>
        <div className="hidden md:flex gap-8 text-[0.7rem] uppercase tracking-[0.15em] font-bold text-white/80">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="hover:text-white cursor-pointer transition-colors bg-transparent border-none"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => scrollToSection('analysis-console')}
            className="px-5 py-2 bg-fs-gold text-fs-ink rounded-full text-[0.75rem] uppercase tracking-wider font-bold hover:bg-fs-gold-soft transition-colors"
          >
            Run Analysis
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact')}
            className="hidden sm:block px-5 py-2 border border-white/30 rounded-full text-[0.75rem] uppercase tracking-wider hover:bg-white/10 transition-colors"
          >
            Request Access
          </button>
        </div>
      </nav>

      <div className="relative z-20 text-center max-w-4xl px-6 mt-[-10vh]">
        <h1 className="font-serif-display text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.05] tracking-tight mb-8 drop-shadow-lg text-white">
          The market floor of <span className="text-fs-gold italic">Vietnam</span>,<br />
          rendered in real time.
        </h1>

        <p className="font-sans-fs text-lg md:text-xl text-white/90 max-w-3xl mx-auto leading-relaxed font-light drop-shadow mb-10">
          FinSight is an agentic intelligence engine for expansion teams in Mobility, Real Estate, F&B and Retail — pulling live commercial rent, competitor pricing and logistics signals from Vietnam's fragmented web.
        </p>

        <button
          type="button"
          onClick={() => scrollToSection('analysis-console')}
          className="px-10 py-4 bg-fs-gold text-fs-ink font-mono-fs text-sm uppercase tracking-widest font-bold rounded-full hover:bg-fs-gold-soft transition-colors shadow-[0_0_30px_rgba(230,180,80,0.3)]"
        >
          Run Analysis
        </button>
      </div>

      <div className="absolute bottom-0 w-full h-[250px] z-10 pointer-events-none text-fs-ink">
        <FooterSkyline style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-fs-ink to-transparent z-10 pointer-events-none" />
    </div>
  );
}
