"use client";

import type { ReactNode } from "react";

export default function Hero({
  eyebrow,
  title,
  titleAccent,
  subtitle,
  actions,
  status,
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-border mb-6" style={{ minHeight: 220 }}>
      {/* Animated gradient mesh stands in for photography — same visual role as
          a hero background image, built entirely from CSS since we can't
          legally embed real product/stock photography. */}
      {/* Real photo background (Lorem Picsum — free, no API key, licensed for
          this use). A fixed seed keeps it stable across reloads. Picsum
          doesn't support keyword search, so this is atmospheric rather than
          literally on-topic — the gradient overlay on top does the real
          work of tying it to our color story. */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://picsum.photos/seed/marketpulse-retail/1600/500"
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: "saturate(0.7) brightness(0.55)" }}
        />
      </div>
      <div className="absolute inset-0" style={{ background: "var(--bg)", opacity: 0.55 }}>
        <div
          className="mesh-blob-1 absolute rounded-full"
          style={{ width: 460, height: 460, top: -140, left: -100, background: "radial-gradient(circle, var(--burgundy) 0%, transparent 68%)", opacity: 0.6, filter: "blur(24px)" }}
        />
        <div
          className="mesh-blob-2 absolute rounded-full"
          style={{ width: 420, height: 420, top: -80, right: -120, background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.4, filter: "blur(28px)" }}
        />
        <div
          className="mesh-blob-3 absolute rounded-full"
          style={{ width: 340, height: 340, bottom: -160, left: "28%", background: "radial-gradient(circle, var(--burgundy) 0%, transparent 68%)", opacity: 0.45, filter: "blur(24px)" }}
        />
        <div
          className="absolute rounded-full mesh-blob-2"
          style={{ width: 260, height: 260, bottom: -80, right: "10%", background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)", opacity: 0.3, filter: "blur(20px)", animationDelay: "3s" }}
        />
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 30%, transparent 30%, rgba(0,0,0,0.25) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 0%, var(--bg) 96%)" }} />
      </div>

      <div className="relative px-8 py-10">
        <p className="text-xs tracking-widest text-accent font-medium mb-3">{eyebrow.toUpperCase()}</p>
        <h1 className="font-serif text-4xl sm:text-5xl leading-none mb-3">
          {title} <span className="text-shimmer italic">{titleAccent}</span>
        </h1>
        <p className="text-sm text-text-secondary max-w-md mb-6">{subtitle}</p>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">{actions}</div>
          {status}
        </div>
      </div>
    </div>
  );
}
