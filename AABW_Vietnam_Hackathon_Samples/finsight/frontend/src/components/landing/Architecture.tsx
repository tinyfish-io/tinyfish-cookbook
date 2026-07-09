import React from 'react';

export function Architecture() {
  return (
    <section className="w-full py-32 px-8 max-w-6xl mx-auto">
      <div className="mb-20 text-center">
        <h4 className="font-mono-fs text-fs-gold text-xs uppercase tracking-[0.2em] mb-4">07 — Architecture</h4>
        <h2 className="font-serif-display text-4xl md:text-5xl text-white tracking-tight leading-[1.1]">
          Built for <span className="text-fs-red italic">scale</span> & <span className="text-fs-gold italic">resilience.</span>
        </h2>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-fs-indigo p-8 md:p-16">
        <div className="absolute inset-0 gold-grid-fine opacity-10" />
        
        {/* Architecture Diagram */}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
          
          {/* Layer 1: Sources */}
          <div className="flex-1 w-full space-y-4">
            <div className="font-mono-fs text-[0.65rem] text-white/40 uppercase tracking-widest text-center">Data Sources</div>
            <div className="space-y-3">
              <div className="h-12 bg-black/40 border border-white/5 rounded-lg flex items-center justify-center font-sans-fs text-sm text-white/70">Local Aggregators</div>
              <div className="h-12 bg-black/40 border border-white/5 rounded-lg flex items-center justify-center font-sans-fs text-sm text-white/70">Gov Portals</div>
              <div className="h-12 bg-black/40 border border-white/5 rounded-lg flex items-center justify-center font-sans-fs text-sm text-white/70">Social Signals</div>
            </div>
          </div>

          {/* Connectors */}
          <div className="hidden md:flex flex-col items-center justify-center space-y-2 opacity-30">
            <div className="w-8 h-[1px] bg-white" />
            <div className="w-8 h-[1px] bg-white" />
            <div className="w-8 h-[1px] bg-white" />
          </div>

          {/* Layer 2: TinyFish Engine */}
          <div className="flex-[1.5] w-full border border-fs-gold/30 rounded-xl bg-fs-night p-6 relative shadow-[0_0_40px_rgba(230,180,80,0.1)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-fs-night px-4 font-mono-fs text-fs-gold text-[0.65rem] uppercase tracking-widest border border-fs-gold/30 rounded-full">
              TinyFish Engine
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 rounded p-4 text-center">
                <div className="font-serif-display text-2xl text-white mb-1">Rotate</div>
                <div className="font-mono-fs text-[0.6rem] text-white/50">Residential IPs</div>
              </div>
              <div className="bg-white/5 rounded p-4 text-center">
                <div className="font-serif-display text-2xl text-white mb-1">Render</div>
                <div className="font-mono-fs text-[0.6rem] text-white/50">Headless Chrome</div>
              </div>
              <div className="bg-white/5 rounded p-4 text-center col-span-2 border border-white/10">
                <div className="font-serif-display text-2xl text-fs-gold mb-1">LLM Synthesis</div>
                <div className="font-mono-fs text-[0.6rem] text-white/70">Context-Aware Extraction</div>
              </div>
            </div>
          </div>

          {/* Connectors */}
          <div className="hidden md:flex flex-col items-center justify-center opacity-30">
            <div className="w-8 h-[1px] bg-white" />
          </div>

          {/* Layer 3: Delivery */}
          <div className="flex-1 w-full space-y-4">
            <div className="font-mono-fs text-[0.65rem] text-white/40 uppercase tracking-widest text-center">Client Delivery</div>
            <div className="h-32 bg-fs-red/10 border border-fs-red/20 rounded-lg flex flex-col items-center justify-center p-4 text-center shadow-[0_0_20px_rgba(214,40,40,0.1)]">
              <div className="font-serif-display text-3xl text-white mb-2">JSON API</div>
              <div className="font-mono-fs text-[0.6rem] text-white/50">Clean, structured truth ready for internal dashboards.</div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
