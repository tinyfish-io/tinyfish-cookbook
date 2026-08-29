"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Radar, CalendarClock, LayoutList, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon: MapPin,
    title: "Track any area you're working",
    body: "Add an area from the homepage — a neighborhood, a property type, rent or sale, and optionally a client name just for your own reference.",
  },
  {
    icon: Radar,
    title: "5 real agents check the market",
    body: "The moment you add an area, real AI agents check Batdongsan.com.vn, Nha Tot, Alonhadat, Homedy, and Cafeland for matching listings — not simulated data.",
  },
  {
    icon: CalendarClock,
    title: "Rechecked automatically, every 48 hours",
    body: "Each tracked area refreshes itself on a schedule, at 11:30 AM Vietnam time — no need to keep clicking anything. \"Check now\" on any area forces an immediate recheck if you need it sooner.",
  },
  {
    icon: LayoutList,
    title: "Open any area for the full picture",
    body: "Click a tracked area to see live agent status and every real listing found, grouped by portal — with a direct link back to the original listing.",
  },
];

export default function OnboardingGuide({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(18, 16, 13, 0.65)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="relative card-surface rounded-2xl p-7 max-w-md w-full"
        >
          <button
            onClick={onClose}
            aria-label="Close guide"
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors"
          >
            <X size={16} />
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.05, type: "spring", stiffness: 400, damping: 16 }}
                className="w-12 h-12 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center mb-4"
              >
                <Icon size={20} className="text-accent" />
              </motion.div>
              <p className="font-serif text-xl mb-2">{current.title}</p>
              <p className="text-sm text-text-secondary leading-relaxed">{current.body}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-7">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <motion.span
                  key={i}
                  animate={{ width: i === step ? 18 : 6, background: i === step ? "var(--accent)" : "var(--border)" }}
                  transition={{ duration: 0.25 }}
                  className="h-1.5 rounded-full inline-block"
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!isLast && (
                <button onClick={onClose} className="text-xs text-text-muted hover:text-text-primary transition-colors">
                  Skip
                </button>
              )}
              <button
                onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
                className="text-xs px-4 py-2 rounded-lg bg-accent text-white font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                {isLast ? "Got it" : "Next"}
                {!isLast && <ArrowRight size={12} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
