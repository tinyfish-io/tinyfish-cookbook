"use client";

import { useEffect } from "react";
import type { Chapter } from "@/lib/types";
import { Scene } from "@/components/manga/scenes";

/**
 * Full-screen chapter title card shown when a chapter begins — the cinematic beat between
 * chapters. Dismisses itself, or on any click/key; reduced motion shortens it to a flash.
 */
export function ChapterCover({ chapter, total, onDone }: { chapter: Chapter; total: number; onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(onDone, reduced ? 700 : 2100);
    const key = () => onDone();
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", key);
    };
  }, [onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      className="fixed inset-0 z-[60] bg-ink text-white overflow-hidden cover-card text-left cursor-pointer"
      aria-label={`Chapter ${chapter.number}: ${chapter.title}. Click to start reading.`}
    >
      <Scene id="speed" seed={chapter.number * 13} className="absolute inset-0 w-full h-full invert opacity-[0.16] cover-speed" />
      <div className="relative h-full flex flex-col justify-center px-[8vw]">
        <div className="font-mono text-[11px] tracking-[0.35em] text-white/60 wipe-in">
          CHAPTER {chapter.number} / {total}
        </div>
        <div className="kicker-slam font-display text-red text-[clamp(72px,16vw,200px)] leading-[0.9] mt-2 origin-left">{chapter.kicker}</div>
        <h2 className="wipe-in font-display text-[clamp(30px,5.4vw,72px)] leading-[1.02] mt-4 max-w-[18ch]" style={{ animationDelay: "260ms" }}>
          {chapter.title}
        </h2>
        {chapter.summary && (
          <p className="ink-in mt-6 text-lg sm:text-xl text-white/75 max-w-[48ch]" style={{ animationDelay: "520ms" }}>
            {chapter.summary}
          </p>
        )}
        <div className="ink-in mt-10 font-mono text-xs text-white/50" style={{ animationDelay: "800ms" }}>
          {chapter.pages.length} pages · click or press any key to begin
        </div>
      </div>
    </button>
  );
}
