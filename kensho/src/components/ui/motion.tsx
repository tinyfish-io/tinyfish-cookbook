"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

// Small, reusable motion primitives. All of them are CSS-driven and collapse to their final
// state under prefers-reduced-motion (see globals.css).

/** Reveals its children once they scroll into view. Elements already on screen reveal immediately. */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  variant = "rise",
  className = "",
  style,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  variant?: "rise" | "panel" | "slam";
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Content must never wait on a single callback: reveal if already on screen, and listen to
    // both IntersectionObserver and scroll position (some embedded/throttled views starve IO).
    const inView = () => el.getBoundingClientRect().top < window.innerHeight * 0.92;
    if (inView()) {
      setShown(true);
      return;
    }
    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      setShown(true);
      cleanup();
    };
    const onScroll = () => inView() && show();
    const io = new IntersectionObserver(([e]) => e.isIntersecting && show(), { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const cleanup = () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    return cleanup;
  }, []);
  return (
    <Tag ref={ref} className={`reveal reveal-${variant} ${shown ? "is-shown" : ""} ${className}`} style={{ ...style, transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** A tilted ink ribbon with scrolling text — the "next episode" divider between sections. */
export function Ribbon({ text, tone = "ink", tilt = -2 }: { text: string; tone?: "ink" | "red" | "paper"; tilt?: number }) {
  const cls = tone === "red" ? "bg-red text-white" : tone === "paper" ? "bg-white text-ink" : "bg-ink text-white";
  const run = Array.from({ length: 8 }, () => text).join("  ·  ");
  return (
    <div aria-hidden className="relative overflow-hidden py-6 select-none">
      <div className={`ribbon ${cls} border-y-[3px] border-ink`} style={{ transform: `rotate(${tilt}deg) scale(1.04)` }}>
        <div className="ribbon-track font-display text-[clamp(16px,2.2vw,26px)] tracking-wide whitespace-nowrap py-2.5">
          <span>{run}  ·  </span>
          <span>{run}  ·  </span>
        </div>
      </div>
    </div>
  );
}

/** "第一話 · EPISODE 1" heading with an outlined giant number, used for every major section. */
export function Episode({ n, jp, title, sub, aside, id }: { n: number; jp: string; title: string; sub?: string; aside?: ReactNode; id?: string }) {
  return (
    <Reveal className="flex items-end gap-3 sm:gap-5" variant="rise">
      <span aria-hidden className="outline-num font-display leading-[0.8] text-[clamp(64px,10vw,128px)] -mb-1 shrink-0">
        {String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <div className="font-display text-red text-xs tracking-[0.3em]">{jp}</div>
        <h2 id={id} className="font-display text-[clamp(26px,4vw,44px)] leading-[1.02] mt-1">
          {title}
        </h2>
        {sub && <p className="text-ink-3 mt-1.5 text-[15px]">{sub}</p>}
      </div>
      {aside && <div className="ml-auto shrink-0 pb-2 hidden sm:block">{aside}</div>}
    </Reveal>
  );
}
