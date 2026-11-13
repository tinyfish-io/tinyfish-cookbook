import type { Panel } from "@/lib/types";

// Page composition. The script only says how big each beat should feel; this module picks
// a page template that fits those beats and the content they hold, so no two pages in a row
// look like the same rectangular grid. Grid: 12 columns × 8 rows (≈ B5 manga page).

export type SlotKind = "big" | "wide" | "tall" | "normal" | "small";
type Edges = { l?: true; r?: true; t?: true; b?: true };
type SlotDef = [col: number, colSpan: number, row: number, rowSpan: number, kind: SlotKind, edges?: Edges];

export interface Slot {
  gridColumn: string;
  gridRow: string;
  kind: SlotKind;
  clip: string;
  points: string;
  pointsMobile: string;
  clipMobile: string;
}

const TEMPLATES: Record<number, SlotDef[][]> = {
  1: [[[1, 12, 1, 8, "big"]]],
  2: [
    [[1, 12, 1, 3, "wide", { b: true }], [1, 12, 4, 5, "big", { t: true }]],
    [[1, 7, 1, 8, "tall", { r: true }], [8, 5, 1, 8, "tall", { l: true }]],
    [[1, 12, 1, 5, "big", { b: true }], [1, 12, 6, 3, "wide", { t: true }]],
  ],
  3: [
    [[1, 12, 1, 3, "wide", { b: true }], [1, 6, 4, 5, "normal", { t: true, r: true }], [7, 6, 4, 5, "normal", { t: true, l: true }]],
    [[1, 5, 1, 8, "tall", { r: true }], [6, 7, 1, 4, "normal", { l: true, b: true }], [6, 7, 5, 4, "normal", { l: true, t: true }]],
    [[1, 7, 1, 4, "normal", { r: true, b: true }], [8, 5, 1, 4, "small", { l: true, b: true }], [1, 12, 5, 4, "wide", { t: true }]],
    [[1, 12, 1, 5, "big", { b: true }], [1, 5, 6, 3, "small", { t: true, r: true }], [6, 7, 6, 3, "wide", { t: true, l: true }]],
  ],
  4: [
    [[1, 12, 1, 2, "wide", { b: true }], [1, 7, 3, 3, "normal", { t: true, r: true, b: true }], [8, 5, 3, 3, "small", { t: true, l: true, b: true }], [1, 12, 6, 3, "wide", { t: true }]],
    [[1, 6, 1, 4, "normal", { r: true, b: true }], [7, 6, 1, 4, "normal", { l: true, b: true }], [1, 6, 5, 4, "normal", { t: true, r: true }], [7, 6, 5, 4, "normal", { t: true, l: true }]],
    [[1, 7, 1, 3, "normal", { r: true, b: true }], [8, 5, 1, 5, "tall", { l: true, b: true }], [1, 7, 4, 2, "small", { r: true, t: true, b: true }], [1, 12, 6, 3, "wide", { t: true }]],
    [[1, 4, 1, 8, "tall", { r: true }], [5, 8, 1, 3, "wide", { l: true, b: true }], [5, 8, 4, 2, "small", { l: true, t: true, b: true }], [5, 8, 6, 3, "normal", { l: true, t: true }]],
  ],
  5: [
    [[1, 6, 1, 3, "normal", { r: true, b: true }], [7, 6, 1, 3, "normal", { l: true, b: true }], [1, 12, 4, 2, "wide", { t: true, b: true }], [1, 6, 6, 3, "normal", { t: true, r: true }], [7, 6, 6, 3, "normal", { t: true, l: true }]],
    [[1, 12, 1, 3, "wide", { b: true }], [1, 4, 4, 5, "tall", { t: true, r: true }], [5, 8, 4, 2, "small", { l: true, t: true, b: true }], [5, 4, 6, 3, "small", { l: true, t: true, r: true }], [9, 4, 6, 3, "small", { l: true, t: true }]],
    [[1, 8, 1, 3, "wide", { r: true, b: true }], [9, 4, 1, 3, "small", { l: true, b: true }], [1, 4, 4, 5, "tall", { t: true, r: true }], [5, 8, 4, 2, "normal", { l: true, t: true, b: true }], [5, 8, 6, 3, "normal", { l: true, t: true }]],
  ],
};

const FIT: Record<Panel["size"], Record<SlotKind, number>> = {
  splash: { big: 4, tall: 1, wide: 1, normal: -1, small: -4 },
  wide: { wide: 3, big: 2, normal: 0, tall: -2, small: -3 },
  tall: { tall: 3, big: 1, normal: 1, wide: -2, small: -2 },
  medium: { normal: 2, wide: 1, big: 1, tall: 1, small: 0 },
  small: { small: 3, normal: 1, tall: -1, wide: -1, big: -2 },
};

function contentFit(p: Panel, kind: SlotKind) {
  // A caption box alone shouldn't eat the biggest slot on the page.
  if (p.kind === "narration") return kind === "big" ? -3 : kind === "tall" ? -2 : kind === "wide" || kind === "small" ? 1 : 0;
  if (p.kind === "concept") return kind === "small" ? -2 : 0;
  if (p.kind === "diagram") return kind === "small" ? -4 : kind === "big" || kind === "wide" ? 2 : 0;
  if (p.kind === "claim") return kind === "small" ? -3 : kind === "tall" ? -1 : 1;
  if (p.kind === "dialogue" && p.cast.length > 1 && kind === "small") return -3;
  if (p.kind === "dialogue" && p.lines.length >= 3 && kind === "small") return -2;
  return 0;
}

// Slant amounts, as % of the panel box.
const SX = 5;
const SY = 9;

function polygon(e: Edges = {}) {
  const tl = [e.l ? SX : 0, e.t ? SY : 0];
  const tr = [100, 0];
  const br = [e.r ? 100 - SX : 100, e.b ? 100 - SY : 100];
  const bl = [0, 100];
  if (e.t) tr[1] = 0;
  if (e.b) bl[1] = 100;
  return [tl, tr, br, bl];
}

const toClip = (pts: number[][]) => `polygon(${pts.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
const toPoints = (pts: number[][]) => pts.map(([x, y]) => `${x},${y}`).join(" ");

export function layoutPage(panels: Panel[], seed: number): Slot[] {
  const n = Math.min(5, Math.max(1, panels.length));
  const options = TEMPLATES[n];
  let best = options[0];
  let bestScore = -Infinity;
  options.forEach((tpl, i) => {
    const score = tpl.reduce((s, [, , , , kind], j) => s + FIT[panels[j].size][kind] + contentFit(panels[j], kind), 0);
    // Seeded tie-break keeps consecutive pages from repeating the same template.
    const jitter = ((seed * 31 + i * 17) % 7) / 10;
    if (score + jitter > bestScore) {
      bestScore = score + jitter;
      best = tpl;
    }
  });
  return best.map(([c, cs, r, rs, kind, edges], i) => {
    const pts = polygon(edges);
    // Single-column mobile layout: alternate gentle top/bottom slants down the strip.
    const mobile = polygon(i === 0 ? { b: true } : i === n - 1 ? { t: true } : { t: true, b: true });
    return {
      gridColumn: `${c} / span ${cs}`,
      gridRow: `${r} / span ${rs}`,
      kind,
      clip: toClip(pts),
      points: toPoints(pts),
      clipMobile: toClip(mobile),
      pointsMobile: toPoints(mobile),
    };
  });
}

export function hash(...parts: (string | number)[]) {
  let h = 2166136261;
  for (const ch of parts.join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.abs(h);
}
