import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiUrl } from '../../lib/api';

const BANK_RATES = [
  { name: 'VPBANK', rate: '5.8%', delta: '+0.1%', up: true },
  { name: 'TECHCOMBANK', rate: '5.5%', delta: '-0.2%', up: false },
  { name: 'BIDV', rate: '4.9%', delta: '0.0%', up: null },
  { name: 'VIETCOMBANK', rate: '4.8%', delta: '-0.1%', up: false },
  { name: 'MB', rate: '5.2%', delta: '+0.2%', up: true },
  { name: 'ACB', rate: '5.1%', delta: '0.0%', up: null },
];

const PLACEHOLDER_CRE = [
  { dist: 'HCMC D1 RENT', price: '—', unit: '', delta: '—' },
  { dist: 'HANOI HOAN KIEM RENT', price: '—', unit: '', delta: '—' },
];

export function MarketPulse() {
  const [creData, setCreData] = useState(PLACEHOLDER_CRE);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTicker = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(apiUrl('/api/v1/market/ticker'));
      if (res.ok) {
        const data = await res.json();
        if (data.ticker_data && data.ticker_data.length > 0) {
          setCreData(
            data.ticker_data.map((item: { label: string; value: string }) => ({
              dist: item.label,
              price: item.value.slice(0, 20) || '—',
              unit: '',
              delta: '+0.0%',
            }))
          );
        }
      }
    } catch (err) {
      console.error('Failed to fetch ticker data', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const topRow = [...BANK_RATES, ...BANK_RATES, ...BANK_RATES];
  const bottomRow = [...creData, ...creData, ...creData, ...creData, ...creData, ...creData];

  return (
    <div className="w-full bg-fs-night border-y border-white/5 py-8 relative overflow-hidden flex flex-col items-center justify-center gap-6">
      <div className="w-full overflow-hidden flex whitespace-nowrap">
        <div className="flex gap-16 min-w-max pr-16" style={{ animation: 'fs-marquee 30s linear infinite' }}>
          {topRow.map((item, i) => (
            <div key={i} className="flex items-center gap-4 font-mono-fs text-sm">
              <span className="text-white/60 tracking-widest">{item.name}</span>
              <span className="text-white font-medium">{item.rate}</span>
              <span className={`text-xs ${item.up === true ? 'text-fs-cyan' : item.up === false ? 'text-fs-red' : 'text-white/30'}`}>
                {item.delta}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full flex items-center justify-center relative my-2 gap-4">
        <div className="absolute w-full h-[1px] hairline-gold" />
        <div className="bg-fs-night px-6 z-10 font-serif-display text-fs-gold text-2xl italic tracking-wide">
          Dữ liệu thị trường — trực tiếp
        </div>
        <button
          type="button"
          onClick={() => void fetchTicker()}
          disabled={isRefreshing}
          className="z-10 flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-fs-night font-mono-fs text-[0.6rem] uppercase tracking-widest text-white/70 hover:border-fs-gold/50 hover:text-fs-gold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Refreshing…' : 'Refresh CRE'}
        </button>
      </div>

      <div className="w-full overflow-hidden flex whitespace-nowrap">
        <div className="flex gap-16 min-w-max pr-16" style={{ animation: 'fs-marquee-rev 35s linear infinite' }}>
          {bottomRow.map((item, i) => (
            <div key={i} className="flex items-center gap-4 font-mono-fs text-sm">
              <span className="text-white/60 tracking-widest">{item.dist}</span>
              <span className="text-fs-gold font-bold">
                {item.price}<span className="text-fs-gold-soft font-normal text-xs">{item.unit}</span>
              </span>
              <span className={`text-xs ${item.delta.startsWith('+') ? 'text-fs-cyan' : 'text-fs-red'}`}>
                {item.delta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
