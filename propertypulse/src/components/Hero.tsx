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
    <div className="relative rounded-2xl overflow-hidden border border-border mb-6" style={{ minHeight: 220 }}>
      {/* Real photo (Lorem Picsum — free, licensed, no API key). Stable seed
          so it doesn't change on reload. Picsum isn't keyword-searchable,
          so this is atmospheric rather than literally a property photo —
          the gradient overlay does the real work of tying it to our theme. */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://picsum.photos/seed/propertypulse-homes/1600/500"
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: "saturate(0.75) brightness(0.5)" }}
        />
      </div>
      <div className="absolute inset-0" style={{ background: "var(--bg)", opacity: 0.5 }}>
        <div
          className="mesh-blob-1 absolute rounded-full"
          style={{ width: 440, height: 440, top: -130, left: -90, background: "radial-gradient(circle, var(--forest) 0%, transparent 68%)", opacity: 0.55, filter: "blur(24px)" }}
        />
        <div
          className="mesh-blob-2 absolute rounded-full"
          style={{ width: 400, height: 400, top: -70, right: -110, background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.4, filter: "blur(26px)" }}
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
        {actions}
      </div>
    </div>
  );
}
