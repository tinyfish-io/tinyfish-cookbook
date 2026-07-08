import React from 'react';

export function OpsProblem() {
  return (
    <section className="w-full py-32 px-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-20 items-center">
      {/* Left: Broken Browser Mock */}
      <div className="flex-1 w-full relative">
        <div className="aspect-[4/3] rounded-xl border border-white/10 bg-fs-indigo overflow-hidden shadow-2xl relative">
          {/* Browser Chrome */}
          <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2 bg-black/40">
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="ml-4 px-3 py-1 bg-white/5 rounded-md text-[0.65rem] font-mono-fs text-white/40 flex-1 overflow-hidden">
              batdongsan.com.vn/commercial-rent/hcmc
            </div>
          </div>
          
          {/* Broken Content Area */}
          <div className="p-8 relative h-full gold-grid-fine">
            {/* 403 Error overlay */}
            <div className="absolute inset-0 bg-fs-red/5 flex items-center justify-center z-10" style={{ animation: 'fs-blink 3s infinite' }}>
              <div className="font-mono-fs text-fs-red font-bold text-5xl opacity-40">
                HTTP 403
              </div>
            </div>

            {/* JS Hydration Skeleton */}
            <div className="space-y-4 opacity-30">
              <div className="w-1/3 h-6 bg-white/10 rounded" />
              <div className="w-full h-32 bg-white/5 rounded flex items-center justify-center">
                <span className="font-mono-fs text-[0.6rem] text-white/50">&lt;noscript&gt;JavaScript is required to view this content&lt;/noscript&gt;</span>
              </div>
              <div className="w-2/3 h-4 bg-white/10 rounded" />
              <div className="w-1/2 h-4 bg-white/10 rounded" />
            </div>

            {/* Floating CAPTCHA box */}
            <div className="absolute bottom-8 right-8 bg-black border border-white/20 p-4 rounded-lg shadow-xl z-20 w-48">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-4 h-4 border border-white/40 rounded-sm" />
                <span className="text-[0.7rem] text-white/80 font-sans-fs">I'm not a robot</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded overflow-hidden">
                <div className="w-1/3 h-full bg-fs-red" style={{ animation: 'fs-marquee 2s linear infinite' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Editorial Prose */}
      <div className="flex-1 w-full space-y-12">
        <h2 className="font-serif-display text-4xl md:text-5xl text-white tracking-tight leading-[1.1]">
          Why traditional <span className="text-fs-red italic">scrapers die</span> in Vietnam.
        </h2>
        
        <div className="space-y-10">
          <div className="flex flex-col gap-2">
            <h3 className="font-sans-fs font-semibold text-fs-gold text-sm uppercase tracking-widest">01. SPA Hydration</h3>
            <p className="font-sans-fs text-white/70 leading-relaxed font-light">
              Modern local platforms like ShopeeFood and Batdongsan load entirely client-side. Standard Python requests fetch blank HTML; vital rent and pricing nodes only exist after heavy JavaScript execution.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <h3 className="font-sans-fs font-semibold text-fs-gold text-sm uppercase tracking-widest">02. Anti-Bot Walls</h3>
            <p className="font-sans-fs text-white/70 leading-relaxed font-light">
              Aggressive WAFs and CAPTCHA gates instantly flag generic headless browsers. Maintaining custom Playwright stealth configurations across shifting Vietnamese DOMs is an ROI-destroying maintenance trap.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-sans-fs font-semibold text-fs-gold text-sm uppercase tracking-widest">03. Token Bloat</h3>
            <p className="font-sans-fs text-white/70 leading-relaxed font-light">
              Even if extracted, raw DOMs from 5 GrabFood pages overwhelm LLM context windows. You pay for extracting ad-trackers, footers, and mega-menus instead of pure competitor signals.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
