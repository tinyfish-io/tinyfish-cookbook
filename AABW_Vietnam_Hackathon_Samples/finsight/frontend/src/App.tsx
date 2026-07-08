import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from 'sonner';
import './styles.css';
import { IntelligenceProvider } from './context/IntelligenceContext';
import { SkyHero } from './components/landing/SkyHero';
import { MarketPulse } from './components/landing/MarketPulse';
import { OpsProblem } from './components/landing/OpsProblem';
import { TinyFishPipeline } from './components/landing/TinyFishPipeline';
import { AnalysisConsole } from './components/landing/AnalysisConsole';
import { QueryMatrix } from './components/landing/QueryMatrix';
import { VerticalPlaybooks } from './components/landing/VerticalPlaybooks';
import { VietnamMap } from './components/landing/VietnamMap';
import { Architecture } from './components/landing/Architecture';
import { ClosingCTA } from './components/landing/ClosingCTA';

export default function App() {
  return (
    <IntelligenceProvider>
      <main className="bg-fs-ink min-h-screen font-sans-fs text-white selection:bg-fs-gold/30 overflow-x-hidden">
        <SkyHero />
        <MarketPulse />
        <OpsProblem />
        <TinyFishPipeline />
        <AnalysisConsole />
        <QueryMatrix />
        <VerticalPlaybooks />
        <VietnamMap />
        <Architecture />
        <ClosingCTA />
      </main>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#0B0F19',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
          },
        }}
      />
      <Analytics />
    </IntelligenceProvider>
  );
}
