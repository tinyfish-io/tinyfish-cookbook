"use client";

import type { Expression, Paper, SceneId } from "@/lib/types";
import { Character } from "@/components/manga/characters";
import { Scene } from "@/components/manga/scenes";
import { hash } from "@/components/manga/layout";

// Every paper gets a manga "volume cover" generated from its metadata: deterministic per
// paper, so the same paper always looks the same, and no image generation is needed.

const SCENES: SceneId[] = ["speed", "focus", "halftone", "circuit", "grid", "space", "cells", "sparkle", "city", "storm"];
const EXPR: Expression[] = ["excited", "surprised", "thinking", "serious", "smug", "happy"];

function sceneFor(p: Paper, h: number): SceneId {
  const t = `${p.title} ${p.venue ?? ""}`.toLowerCase();
  if (/quantum|physic|particle|cosmo|astro|gravit/.test(t)) return "space";
  if (/cell|gene|protein|crispr|bio|dna|rna|neuro/.test(t)) return "cells";
  if (/math|theorem|algebra|proof|equation|optimi/.test(t)) return "grid";
  if (/security|attack|adversar|crypt|malware/.test(t)) return "storm";
  if (/network|neural|model|learning|transformer|language|vision|ai\b/.test(t)) return h % 2 ? "circuit" : "speed";
  return SCENES[h % SCENES.length];
}

export function PaperCover({ paper, className = "", size = "md" }: { paper: Paper; className?: string; size?: "sm" | "md" | "lg" }) {
  const h = hash(paper.id);
  const scene = sceneFor(paper, h);
  const dark = scene === "space" || scene === "storm" || scene === "city";
  const char = (["hoshi", "kai", "sumi"] as const)[h % 3];
  const lead = paper.authors[0]?.replace(/,.*/, "");
  const titleSize = size === "lg" ? "text-[clamp(20px,2.4vw,30px)]" : size === "sm" ? "text-[13px]" : "text-[15px] sm:text-[17px]";
  return (
    <div className={`relative overflow-hidden border-[3px] border-ink bg-white aspect-[3/4.2] ${className}`} style={{ containerType: "inline-size" }}>
      <Scene id={scene} seed={h} className="absolute inset-0 w-full h-full" />
      <div className={`absolute inset-x-0 top-0 h-[58%] ${dark ? "bg-gradient-to-b from-black/70 to-transparent" : "bg-gradient-to-b from-white via-white/85 to-transparent"}`} />
      <div className="absolute left-0 right-0 bottom-0 h-[56%] flex justify-end items-end pointer-events-none">
        <Character id={char} expression={EXPR[h % EXPR.length]} pose={char === "sumi" ? "idle" : (["point", "explain", "think", "cheer"] as const)[h % 4]} className="w-[72%] h-auto translate-x-[8%] translate-y-[4%]" flip={h % 2 === 0} />
      </div>
      <div className="relative p-[7%] flex flex-col gap-[4cqw]">
        <div className="flex items-center gap-1.5">
          <span className="bg-red text-white font-display text-[9px] tracking-[0.18em] px-1.5 py-0.5">VOL.{paper.year ?? "—"}</span>
          <span className={`font-mono text-[9px] uppercase tracking-wider truncate ${dark ? "text-white" : "text-ink"}`}>{paper.siteName}</span>
        </div>
        <h3 className={`font-display leading-[1.08] ${titleSize} ${dark ? "text-white" : "text-ink"} line-clamp-5`} style={{ textWrap: "balance" }}>
          {paper.title}
        </h3>
        {lead && <span className={`font-bold text-[11px] ${dark ? "text-white/85" : "text-ink-2"}`}>{lead}{paper.authors.length > 1 ? " et al." : ""}</span>}
      </div>
      <div className="absolute bottom-0 inset-x-0 h-[7%] bg-ink flex items-center px-[6%] gap-2">
        <span className="font-display text-white text-[9px] tracking-[0.2em]">KENSHŌ</span>
        <span className="h-px flex-1 bg-white/40" />
        <span className="font-mono text-white/80 text-[9px]">{paper.venue?.slice(0, 18)}</span>
      </div>
    </div>
  );
}

/** Says only what is known: a confirmed status after reading, or an honest guess at discovery. */
export function accessInfo(paper: Paper): { label: string; hint: string; cls: string; icon: string } {
  if (paper.availabilityConfirmed) {
    return paper.availability === "full_text"
      ? { label: "Full text read", icon: "■", hint: "Kenshō read the complete paper. Chapters cover the whole study.", cls: "bg-ink text-white" }
      : { label: "Abstract only", icon: "□", hint: "The full text isn’t openly accessible, so the manga covers only what the abstract says.", cls: "bg-white text-ink border-dashed" };
  }
  switch (paper.availability) {
    case "full_text":
      return { label: "PDF link found", icon: "◆", hint: "An open PDF or repository copy was found. Kenshō confirms full-text access when it reads the paper.", cls: "bg-white text-ink" };
    case "abstract_only":
      return { label: "Likely abstract only", icon: "◇", hint: "Published behind a subscription with no open copy found. Expect an abstract-only manga.", cls: "bg-paper text-ink-3 border-dashed" };
    default:
      return { label: "Access unchecked", icon: "?", hint: "Access will be checked when Kenshō opens the paper.", cls: "bg-paper text-ink-3" };
  }
}

export function AvailabilityBadge({ paper }: { paper: Paper; confirmed?: boolean }) {
  const a = accessInfo(paper);
  return (
    <span title={a.hint} className={`inline-flex items-center gap-1 border-2 border-ink px-1.5 py-0.5 text-[10px] font-black tracking-wider uppercase ${a.cls}`}>
      <span aria-hidden>{a.icon}</span>
      {a.label}
    </span>
  );
}
