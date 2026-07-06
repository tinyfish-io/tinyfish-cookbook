import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

const RADAR_DATA = [
  { subject: 'Base Fare', Grab: 120, Be: 110, XanhSM: 130, fullMark: 150 },
  { subject: 'Per Km', Grab: 98, Be: 90, XanhSM: 105, fullMark: 150 },
  { subject: 'Wait Time', Grab: 86, Be: 130, XanhSM: 70, fullMark: 150 },
  { subject: 'Surge', Grab: 140, Be: 100, XanhSM: 80, fullMark: 150 },
  { subject: 'Promo', Grab: 90, Be: 140, XanhSM: 120, fullMark: 150 },
];

export function VerticalPlaybooks() {
  return (
    <section className="w-full py-32 px-8 max-w-6xl mx-auto">
      <div className="mb-16">
        <h4 className="font-mono-fs text-fs-gold text-xs uppercase tracking-[0.2em] mb-4">05 — Playbooks</h4>
        <h2 className="font-serif-display text-4xl md:text-5xl text-white tracking-tight leading-[1.1]">
          Four verticals.<br/>
          <span className="text-fs-gold italic">One operating substrate.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[240px]">
        <div className="col-span-1 md:col-span-2 bg-fs-indigo border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-fs-gold/50 transition-colors duration-500">
          <div className="relative z-20">
            <h3 className="font-serif-display text-2xl text-white mb-1">Mobility</h3>
            <div className="font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest">GRAB · BE · XANH SM</div>
          </div>
          <div className="absolute inset-0 pt-16 px-2 pb-2 z-10 opacity-70 group-hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={RADAR_DATA}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)' }}
                  itemStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                />
                <Radar name="Grab" dataKey="Grab" stroke="#00B14F" fill="#00B14F" fillOpacity={0.3} />
                <Radar name="Be" dataKey="Be" stroke="#F6D13F" fill="#F6D13F" fillOpacity={0.3} />
                <Radar name="XanhSM" dataKey="XanhSM" stroke="#00C1D5" fill="#00C1D5" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-1 md:col-span-1 bg-fs-indigo border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-fs-gold/50 transition-colors duration-500">
          <div className="relative z-10 mb-6">
            <h3 className="font-serif-display text-2xl text-white mb-1">Real Estate</h3>
            <div className="font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest">BATDONGSAN · CHOTOT · CBRE</div>
          </div>
          <div className="flex flex-col gap-2 relative z-10">
            {[5, 4, 3, 2, 1].map((floor, i) => (
              <div key={floor} className="flex items-center gap-4 text-xs font-mono-fs">
                <span className="text-white/40">L{floor}</span>
                <div className="flex-1 h-4 border border-white/10 bg-black/20 rounded-sm overflow-hidden relative">
                  <div className="absolute top-0 left-0 h-full bg-fs-gold/30" style={{ width: `${[80, 60, 45, 30, 20][i]}%` }} />
                </div>
                <span className="text-fs-gold">${[78, 64, 52, 41, 32][i]}/m²</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-1 md:col-span-1 bg-fs-indigo border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-fs-gold/50 transition-colors duration-500">
          <div className="relative z-10">
            <h3 className="font-serif-display text-2xl text-white mb-1">F&B</h3>
            <div className="font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest">GRABFOOD · SHOPEEFOOD · NOW</div>
          </div>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-48 bg-[#f5f5f0] rounded text-black p-4 shadow-xl rotate-[-2deg]">
            <div className="text-center font-mono-fs text-[10px] font-bold border-b border-black/20 pb-2 mb-2">HIGHLANDS - D1</div>
            <div className="space-y-1 font-mono-fs text-[8px] flex flex-col border-b border-black/20 pb-2 mb-2">
              <div className="flex justify-between"><span>Cà phê sữa đá</span><span>32k</span></div>
              <div className="flex justify-between"><span>Đen đá</span><span>29k</span></div>
              <div className="flex justify-between"><span>Trà đào cam sả</span><span>55k</span></div>
              <div className="flex justify-between"><span>Bánh mì pate</span><span>29k</span></div>
              <div className="flex justify-between font-bold mt-1 pt-1 border-t border-black/20"><span>Combo lunch</span><span>85k</span></div>
            </div>
            <div className="text-center font-mono-fs text-[6px] text-black/50">fetched: 4m ago</div>
            <div className="absolute -bottom-2 left-0 w-full h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjQiPjxwb2x5Z29uIHBvaW50cz0iMCwwIDgsMCA0LDQiIGZpbGw9IiNmNWY1ZjAiLz48L3N2Zz4=')] bg-repeat-x" />
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 bg-fs-indigo border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-fs-gold/50 transition-colors duration-500">
          <div className="relative z-10 mb-6">
            <h3 className="font-serif-display text-2xl text-white mb-1">Retail</h3>
            <div className="font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest">TIKI · LAZADA · SHOPEE VN</div>
          </div>
          <div className="absolute inset-x-6 bottom-0 top-24 overflow-hidden mask-image-bottom">
            <div className="grid grid-cols-8 gap-1 h-full">
              {Array.from({ length: 32 }).map((_, i) => (
                <div key={i} className="bg-fs-gold/30 rounded-sm aspect-square relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 delay-[calc(var(--i)*50ms)]" style={{ '--i': i } as React.CSSProperties} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
