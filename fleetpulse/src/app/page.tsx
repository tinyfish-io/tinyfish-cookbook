"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import Hero from "@/components/Hero";
import VehicleForm from "@/components/VehicleForm";
import VehicleCard from "@/components/VehicleCard";
import OnboardingGuide, { type GuideStep } from "@/components/OnboardingGuide";
import { hasShownGuide, markGuideShown } from "@/lib/guideSession";
import { fetchJson } from "@/lib/fetchJson";
import type { Vehicle } from "@/lib/types";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export default function HomePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(() => !hasShownGuide());

  const addButtonRef = useRef<HTMLButtonElement>(null);
  const firstCardRef = useRef<HTMLAnchorElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/vehicles");
      setVehicles(data.vehicles);
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

  function closeGuide() {
    markGuideShown();
    setShowGuide(false);
  }

  const guideSteps: GuideStep[] = [
    { ref: addButtonRef, title: "Add a vehicle", body: "Enter its model, plate, fuel type, and class — the cost checks that follow are personalized to exactly this vehicle." },
    { ref: firstCardRef, title: "Click a vehicle for the full picture", body: "Opens live agent status and personalized fuel, toll, and competitor pricing for this specific vehicle, plus its service status." },
  ];

  if (loadError) {
    return (
      <>
        {showGuide && <OnboardingGuide steps={guideSteps} onClose={closeGuide} />}
        <div className="card-surface rounded-xl p-6">
          <p className="text-sm font-medium text-danger mb-1">Couldn't load your fleet</p>
          <p className="text-xs text-text-muted break-words">{loadError}</p>
        </div>
      </>
    );
  }

  return (
    <div>
      {showGuide && loaded && <OnboardingGuide steps={guideSteps} onClose={closeGuide} />}
      <Hero
        eyebrow="Vietnam · Mobility · Fleet Intelligence"
        title="Fleet"
        titleAccent="Pulse"
        subtitle="Personalized fuel, toll, and competitor cost tracking per vehicle — with automated Tasco Auto service booking when one comes due."
        actions={<VehicleForm ref={addButtonRef} onAdded={load} />}
      />

      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-12">No vehicles yet — add one above to get started.</p>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.map((v, i) => (
            <VehicleCard key={v.id} vehicle={v} ref={i === 0 ? firstCardRef : undefined} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
