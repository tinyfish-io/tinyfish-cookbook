"use client";

import { motion } from "framer-motion";

const PARTICLES = [
  { left: "8%", delay: 0, duration: 7 },
  { left: "18%", delay: 1.5, duration: 8 },
  { left: "32%", delay: 0.6, duration: 6.5 },
  { left: "48%", delay: 2.2, duration: 9 },
  { left: "63%", delay: 0.9, duration: 7.5 },
  { left: "77%", delay: 1.8, duration: 8.5 },
  { left: "90%", delay: 0.3, duration: 6 }
];

export function Hero() {
  return (
    <div className="relative h-64 md:h-72 overflow-hidden">
      <div
        className="absolute inset-0 hero-zoom bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.pexels.com/photos/31449083/pexels-photo-31449083.jpeg?auto=compress&cs=tinysrgb&w=1920')"
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,5,8,0.55) 0%, rgba(10,5,8,0.78) 55%, #0A0508 100%), linear-gradient(90deg, rgba(122,19,48,0.55) 0%, transparent 55%)"
        }}
      />

      {/* Floating gold particles — self-generated motion, no sourced media */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute bottom-0 h-1 w-1 rounded-full bg-gold"
            style={{
              left: p.left,
              animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`
            }}
          />
        ))}
      </div>

      <div className="relative h-full max-w-6xl mx-auto px-6 flex flex-col justify-end pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-[10px] uppercase tracking-[0.2em] text-gold font-medium"
          >
            Ho Chi Minh City · Vietnam
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
            className="font-display text-3xl md:text-4xl font-bold text-paper mt-1.5 leading-tight"
          >
            Rate<span className="text-gold">Radar</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-sm text-paper/70 mt-1.5 max-w-md"
          >
            Live loan rates and savings yields across Vietnam&apos;s banks, featuring Shinhan Bank.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
