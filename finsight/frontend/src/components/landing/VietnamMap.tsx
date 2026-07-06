import React, { useState } from 'react';

const CITIES = [
  { name: 'Hà Nội', x: 160, y: 150, cre: '$62.10/m²', comps: 312 },
  { name: 'Hải Phòng', x: 180, y: 180, cre: '$38.50/m²', comps: 89 },
  { name: 'Vinh', x: 150, y: 300, cre: '$28.20/m²', comps: 45 },
  { name: 'Huế', x: 160, y: 400, cre: '$35.80/m²', comps: 67 },
  { name: 'Đà Nẵng', x: 170, y: 450, cre: '$48.90/m²', comps: 124 },
  { name: 'Quy Nhơn', x: 165, y: 550, cre: '$31.40/m²', comps: 38 },
  { name: 'Nha Trang', x: 155, y: 650, cre: '$42.60/m²', comps: 76 },
  { name: 'TP. HCM', x: 90, y: 700, cre: '$78.40/m²', comps: 547, highlight: true },
];

export function VietnamMap() {
  const [activeCity, setActiveCity] = useState(CITIES[7]);

  return (
    <section
      id="coverage"
      className="w-full py-32 px-8 bg-fs-night border-t border-white/5 relative overflow-hidden flex flex-col md:flex-row items-center justify-center gap-20 scroll-mt-24"
    >
      <div className="flex-1 max-w-md z-10 space-y-12">
        <div>
          <h4 className="font-mono-fs text-fs-gold text-xs uppercase tracking-[0.2em] mb-4">06 — Coverage</h4>
          <h2 className="font-serif-display text-4xl md:text-5xl text-white tracking-tight leading-[1.1] mb-6">
            From <span className="text-fs-gold italic">Hà Nội</span> down<br/>to <span className="text-fs-gold italic">Cà Mau</span>.
          </h2>
          <p className="font-sans-fs text-white/70 text-sm leading-relaxed font-light">
            Eight metropolitan markets live today, indexed continuously by the TinyFish engine. Hover a city to read its current commercial rent and active competitor count.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-white/10 bg-fs-indigo/50 backdrop-blur transition-all duration-300">
          <div className="font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest mb-2">Now Monitoring</div>
          <h3 className="font-serif-display text-3xl text-white mb-8">{activeCity.name}</h3>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="font-mono-fs text-[0.6rem] text-white/40 uppercase tracking-widest mb-1">CRE Index</div>
              <div className="font-sans-fs text-fs-gold font-bold text-xl">{activeCity.cre}</div>
            </div>
            <div>
              <div className="font-mono-fs text-[0.6rem] text-white/40 uppercase tracking-widest mb-1">Tracked Comps</div>
              <div className="font-sans-fs text-white font-bold text-xl">{activeCity.comps}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-[400px] flex items-center justify-center pt-10">
        <svg viewBox="0 0 300 800" className="w-full h-full drop-shadow-2xl">
          <path
            d="M 100 100 Q 150 50 180 120 Q 220 200 160 300 Q 140 400 120 500 Q 100 600 50 700 Q 20 750 60 780 Q 90 750 150 650 Q 200 500 180 300 Q 160 200 180 150 Z"
            fill="none"
            stroke="rgba(230,180,80,0.4)"
            strokeWidth="1.5"
          />

          {CITIES.filter((c) => !c.highlight).map((city) => (
            <g
              key={city.name}
              transform={`translate(${city.x}, ${city.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setActiveCity(city)}
            >
              <circle
                cx="0"
                cy="0"
                r={activeCity.name === city.name ? 5 : 3}
                fill={activeCity.name === city.name ? '#e6b450' : 'rgba(255,255,255,0.4)'}
                className="transition-all duration-200"
              />
              <text x="12" y="3" fill="white" className="font-serif-display text-sm" opacity="0.8">
                {city.name}
              </text>
            </g>
          ))}

          {CITIES.filter((c) => c.highlight).map((city) => (
            <g
              key={city.name}
              transform={`translate(${city.x}, ${city.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setActiveCity(city)}
            >
              <circle cx="0" cy="0" r="12" fill="rgba(230,180,80,0.2)" />
              <circle
                cx="0"
                cy="0"
                r="4"
                fill={activeCity.name === city.name ? '#e6b450' : '#e6b450'}
                className="transition-all duration-200"
              />
              <text x="20" y="4" fill="white" className="font-serif-display text-sm" opacity="0.9">
                {city.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
