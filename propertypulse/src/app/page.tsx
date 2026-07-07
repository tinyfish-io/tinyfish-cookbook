"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Hero from "@/components/Hero";
import SearchForm from "@/components/SearchForm";
import SearchCard from "@/components/SearchCard";
import OnboardingGuide from "@/components/OnboardingGuide";
import { fetchJson } from "@/lib/fetchJson";
import type { TrackedSearch } from "@/lib/types";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export default function HomePage() {
  const [searches, setSearches] = useState<TrackedSearch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Shows on every load/refresh, deliberately — not the usual "seen once"
  // onboarding pattern. Close it with the X (or Skip/Got it) any time.
  const [showGuide, setShowGuide] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/searches");
      setSearches(data.searches);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (loadError) {
    return (
      <>
        {showGuide && <OnboardingGuide onClose={() => setShowGuide(false)} />}
        <div className="card-surface rounded-xl p-6">
          <p className="text-sm font-medium text-danger mb-1">Couldn't load your tracked areas</p>
          <p className="text-xs text-text-muted break-words">{loadError}</p>
        </div>
      </>
    );
  }

  return (
    <div>
      {showGuide && <OnboardingGuide onClose={() => setShowGuide(false)} />}
      <Hero
        eyebrow="Vietnam · Real Estate Intelligence"
        title="Property"
        titleAccent="Pulse"
        subtitle="Track live listings across 5 major Vietnam property portals, on behalf of your clients — built for agencies, not individual house-hunters."
        actions={<SearchForm onAdded={load} />}
      />

      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-12">No tracked areas yet — add one above to get started.</p>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {searches.map((s) => (
            <SearchCard key={s.id} search={s} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
