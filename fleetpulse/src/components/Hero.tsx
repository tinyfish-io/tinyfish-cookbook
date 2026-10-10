"use client";

import type { ReactNode } from "react";

export default function Hero({
  eyebrow,
  title,
  titleAccent,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-border mb-6" style={{ minHeight: 200 }}>
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://picsum.photos/seed/fleetpulse-highway-42/1920/560"
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: "saturate(0.7) brightness(0.5)" }}
        />
      </div>
      <div className="absolute inset-0" style={{ background: "var(--bg)", opacity: 0.5 }}>
        <div className="mesh-blob-1 absolute rounded-full" style={{ width: 460, height: 460, top: -140, left: -100, background: "radial-gradient(circle, var(--steel) 0%, transparent 68%)", opacity: 0.6, filter: "blur(26px)" }} />
        <div className="mesh-blob-2 absolute rounded-full" style={{ width: 420, height: 420, top: -80, right: -110, background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.42, filter: "blur(28px)" }} />
        <div className="mesh-blob-1 absolute rounded-full" style={{ width: 300, height: 300, bottom: -140, left: "30%", background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.3, filter: "blur(22px)", animationDelay: "4s" }} />
        <div className="mesh-blob-2 absolute rounded-full" style={{ width: 240, height: 240, bottom: -70, right: "12%", background: "radial-gradient(circle, var(--steel) 0%, transparent 70%)", opacity: 0.35, filter: "blur(20px)", animationDelay: "2s" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 30%, transparent 30%, rgba(0,0,0,0.25) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 0%, var(--bg) 96%)" }} />
      </div>

      <div className="relative px-8 py-9">
        <p className="text-xs tracking-widest text-accent font-medium mb-3">{eyebrow.toUpperCase()}</p>
        <h1 className="font-serif text-4xl sm:text-5xl leading-none mb-3">
          {title} <span className="text-shimmer italic">{titleAccent}</span>
        </h1>
        <p className="text-sm text-text-secondary max-w-md mb-6">{subtitle}</p>
        {actions}
      </div>
    </div>
  );
}
