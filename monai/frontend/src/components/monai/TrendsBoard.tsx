import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchEmergingTrends, isApiConfigured, type Trend } from "@/lib/api";

type DisplayTrend = {
  name: string;
  growth: string;
  region: string;
};

function toDisplay(t: Trend, location: string): DisplayTrend {
  return {
    name: t.trend_name,
    growth: t.growth_rate,
    region: t.region ?? location,
  };
}

export function TrendsBoard() {
  const [trends, setTrends] = useState<DisplayTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiConfigured()) {
      setError("API not configured. Start the backend or set VITE_API_BASE_URL.");
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchEmergingTrends("TP.HCM", "food and beverage");
        if (cancelled) return;
        setTrends(res.emerging_trends.map((t) => toDisplay(t, res.location)));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load trends");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="trends" className="paper-texture px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <span className="stamp stamp--hot mb-4">HOT TREND</span>
          <h2 className="chopstick-heading mt-4 font-[family-name:var(--font-display)] text-3xl italic text-nuoc md:text-4xl">
            Live Trend Board
          </h2>
          <div className="mt-3 flex items-center justify-center gap-2 text-muted-foreground">
            <span>Street-food chalkboard menu — updated from MónAI intelligence</span>
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
          </div>
          {error && (
            <p className="mt-2 text-xs text-chili">{error}</p>
          )}
        </div>

        <div className="chalkboard p-6 md:p-8">
          <div className="mb-4 border-b border-dashed border-cream/20 pb-3 text-center text-sm tracking-[0.3em] text-foam">
            — MÓN ĐANG HOT —
          </div>
          {!loading && trends.length === 0 && !error && (
            <p className="text-center text-sm text-foam/70">No trends loaded yet.</p>
          )}
          {trends.map((trend, index) => (
            <div key={`${trend.name}-${index}`} className="chalkboard-row">
              <span className="text-base md:text-lg">{trend.name}</span>
              <span className="text-crust">{trend.region}</span>
              <span className="text-lg text-foam md:text-xl">{trend.growth}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
