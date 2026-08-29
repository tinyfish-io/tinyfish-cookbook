"use client";

import { useEffect, useState, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";

export interface GuideStep {
  ref: RefObject<HTMLElement>;
  title: string;
  body: string;
}

function measure(ref: RefObject<HTMLElement>) {
  const el = ref.current;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function OnboardingGuide({ steps, onClose }: { steps: GuideStep[]; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    function update() {
      let i = stepIndex;
      while (i < steps.length && !steps[i].ref.current) i++;
      if (i !== stepIndex) {
        if (i >= steps.length) return; // stay mounted — the close button below must always remain available
        setStepIndex(i);
        return;
      }
      steps[stepIndex].ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setRect(measure(steps[stepIndex].ref));
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, steps]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;
  const padding = 8;
  const spotlight = rect ? { top: rect.top - padding, left: rect.left - padding, width: rect.width + padding * 2, height: rect.height + padding * 2 } : null;
  const tooltipBelow = spotlight ? window.innerHeight - (spotlight.top + spotlight.height) > 180 : true;
  const tooltipTop = spotlight ? (tooltipBelow ? spotlight.top + spotlight.height + 14 : spotlight.top - 14) : 24;
  const tooltipLeft = spotlight ? Math.min(Math.max(spotlight.left, 16), window.innerWidth - 320) : Math.max(16, window.innerWidth / 2 - 160);

  return (
    <AnimatePresence>
      {/* This outer fixed layer, and the close button inside it, are ALWAYS
          rendered the entire time the guide is open — previously an early
          `if (!rect) return null` gated the whole component on the target's
          position being measurable yet, which meant the close button could
          vanish along with everything else if that measurement was ever
          delayed or failed. The close button must never depend on that. */}
      <div className="fixed inset-0 z-50" onClick={onClose}>
        {spotlight && (
          <motion.div
            className="absolute rounded-xl pointer-events-none"
            animate={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ boxShadow: "0 0 0 9999px rgba(10, 12, 15, 0.72)", border: "2px solid var(--accent)" }}
          />
        )}
        {!spotlight && <div className="absolute inset-0" style={{ background: "rgba(10, 12, 15, 0.72)" }} />}

        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute card-surface rounded-xl p-5 max-w-xs shadow-lg"
            style={{ top: tooltipTop, left: tooltipLeft, transform: spotlight && !tooltipBelow ? "translateY(-100%)" : undefined }}
          >
            <p className="text-sm font-medium mb-1.5">{step.title}</p>
            <p className="text-xs text-text-secondary leading-relaxed mb-4">{step.body}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <span key={i} className="h-1.5 rounded-full inline-block" style={{ width: i === stepIndex ? 16 : 6, background: i === stepIndex ? "var(--accent)" : "var(--border)" }} />
                ))}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isLast ? onClose() : setStepIndex((s) => s + 1);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                {isLast ? "Got it" : "Next"}
                {!isLast && <ArrowRight size={11} />}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close guide"
          className="fixed top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/15 hover:bg-white/25 transition-colors"
          style={{ zIndex: 100 }}
        >
          <X size={18} />
        </button>
      </div>
    </AnimatePresence>
  );
}
