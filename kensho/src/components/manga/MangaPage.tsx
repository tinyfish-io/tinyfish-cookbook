"use client";

import type { MangaPage } from "@/lib/types";
import { hash, layoutPage } from "./layout";
import { PanelView } from "./panels";

export function MangaPageView({
  page,
  pageNumber,
  chapterKicker,
  seedKey,
  className = "",
}: {
  page: MangaPage;
  pageNumber: number;
  chapterKicker?: string;
  seedKey: string;
  className?: string;
}) {
  const seed = hash(seedKey, pageNumber);
  const slots = layoutPage(page.panels, seed);
  return (
    <article className={`manga-page relative bg-white text-ink ${className}`} aria-label={`Page ${pageNumber}`}>
      <div className="manga-grid">
        {page.panels.slice(0, slots.length).map((panel, i) => {
          const slot = slots[i];
          return (
            <div
              key={i}
              className="manga-slot relative"
              style={{ gridColumn: slot.gridColumn, gridRow: slot.gridRow, ["--clip" as string]: slot.clip, ["--clip-m" as string]: slot.clipMobile }}
            >
              <div className="manga-clip relative w-full h-full overflow-hidden bg-white" style={{ containerType: "inline-size" }}>
                <PanelView panel={panel} kind={slot.kind} seed={hash(seed, i)} />
                <svg className="panel-frame frame-desktop absolute inset-0 w-full h-full pointer-events-none z-30" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  <polygon points={slot.points} fill="none" stroke="var(--ink)" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
                </svg>
                <svg className="panel-frame frame-mobile absolute inset-0 w-full h-full pointer-events-none z-30" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  <polygon points={slot.pointsMobile} fill="none" stroke="var(--ink)" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      <footer className="flex items-center justify-between px-[4cqw] pb-[2.4cqw] pt-[1cqw] font-mono text-[10px] text-ink-3">
        <span>{chapterKicker}</span>
        <span className="font-display text-ink text-xs">{pageNumber}</span>
      </footer>
    </article>
  );
}
