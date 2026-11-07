"use client";

import { useEffect, useMemo, useState } from "react";
import type { Diagram } from "@/lib/types";
import { RefChips, RichText } from "./lettering";

// Diagrams share the manga's ink language (heavy strokes, screentone fills, one red
// highlight) but are real interactive figures: hover, step through, or run them.

const INK = "var(--ink)";
const f = (n: number) => Math.round(n * 100) / 100;

const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", i: "ᵢ", j: "ⱼ", k: "ₖ", n: "ₙ", t: "ₜ", m: "ₘ", x: "ₓ" };
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", T: "ᵀ", n: "ⁿ", i: "ⁱ", "-": "⁻" };

/** Turns ASCII/LaTeX-ish math from the script into readable Unicode typography. */
export function prettyMath(s: string) {
  return s
    .replace(/\\(cdot|times)\b/g, (_, w) => (w === "cdot" ? "·" : "×"))
    .replace(/\\(sqrt|sum|alpha|beta|theta|lambda|sigma|mu|pi|infty|in|leq|geq|approx)\b/g, (_, w) =>
      ({ sqrt: "√", sum: "Σ", alpha: "α", beta: "β", theta: "θ", lambda: "λ", sigma: "σ", mu: "μ", pi: "π", infty: "∞", in: "∈", leq: "≤", geq: "≥", approx: "≈" })[w as string] ?? w,
    )
    .replace(/sqrt\s*\(/g, "√(")
    // Only whole exponents/indices that Unicode can express; anything else stays readable as ^(…) / _(…).
    .replace(/\^(?:\{([^}]+)\}|([0-9Tni](?![A-Za-z])))/g, (_, a: string | undefined, b: string | undefined) => {
      const g = a ?? b ?? "";
      return [...g].every((c) => SUP[c]) ? [...g].map((c) => SUP[c]).join("") : `^(${g})`;
    })
    .replace(/_(?:\{([^}]+)\}|([0-9ijkntmx](?![A-Za-z])))/g, (_, a: string | undefined, b: string | undefined) => {
      const g = a ?? b ?? "";
      return [...g].every((c) => SUB[c]) ? [...g].map((c) => SUB[c]).join("") : `_${g}`;
    })
    .replace(/\s*\*\s*/g, " · ")
    .replace(/[{}]/g, "");
}

function StepButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="font-display text-[11px] tracking-wider bg-ink text-white px-2.5 py-1 hover:bg-red transition-colors"
    >
      {children}
    </button>
  );
}

/* ───────────── flow (layered DAG) ───────────── */

function Flow({ d }: { d: Extract<Diagram, { type: "flow" }> }) {
  const [active, setActive] = useState<string | null>(null);
  const layout = useMemo(() => {
    const level = new Map<string, number>(d.nodes.map((n) => [n.id, 0]));
    for (let pass = 0; pass < d.nodes.length; pass++)
      for (const e of d.edges) if ((level.get(e.to) ?? 0) <= (level.get(e.from) ?? 0) && e.from !== e.to) level.set(e.to, Math.min(d.nodes.length, (level.get(e.from) ?? 0) + 1));
    const cols: string[][] = [];
    for (const n of d.nodes) (cols[level.get(n.id)!] ??= []).push(n.id);
    const dense = cols.filter(Boolean);
    const pos = new Map<string, { x: number; y: number }>();
    const W = 100 / dense.length;
    dense.forEach((col, ci) => col.forEach((id, ri) => pos.set(id, { x: W * ci + W / 2, y: ((ri + 0.5) / col.length) * 100 })));
    return { pos, cols: dense.length, rows: Math.max(...dense.map((c) => c.length)) };
  }, [d]);

  const node = (id: string) => d.nodes.find((n) => n.id === id)!;
  const height = Math.max(200, layout.rows * 104);
  // Edges run between node edges (not centres) so arrowheads stay visible.
  const half = Math.min(44 / layout.cols, 22);
  const ends = (e: { from: string; to: string }) => {
    const a = layout.pos.get(e.from)!;
    const b = layout.pos.get(e.to)!;
    const dir = b.x === a.x ? 0 : b.x > a.x ? 1 : -1;
    return { x1: f(a.x + dir * half), y1: a.y, x2: f(b.x - dir * (half + 1)), y2: b.y };
  };
  return (
    <div className="relative w-full" style={{ height }}>
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill={INK} />
          </marker>
        </defs>
        {d.edges.map((e, i) => {
          const { x1, y1, x2, y2 } = ends(e);
          const hot = active === e.from || active === e.to;
          const mx = f((x1 + x2) / 2);
          return (
            <path
              key={i}
              d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
              fill="none"
              stroke={hot ? "var(--red)" : INK}
              strokeWidth={hot ? 3.4 : 2.4}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="6 5"
              style={{ animation: "dash 1.2s linear infinite", strokeDashoffset: 22 }}
              markerEnd="url(#arrow)"
            />
          );
        })}
      </svg>
      {d.nodes.map((n) => {
        const p = layout.pos.get(n.id)!;
        const hot = active === n.id;
        return (
          <button
            key={n.id}
            type="button"
            onMouseEnter={() => setActive(n.id)}
            onMouseLeave={() => setActive(null)}
            onClick={(e) => {
              e.stopPropagation();
              setActive(hot ? null : n.id);
            }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 border-[2.5px] border-ink px-2 py-1.5 text-center transition-all ${hot ? "bg-ink text-white scale-105" : "bg-white"}`}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `min(${Math.floor(88 / layout.cols)}%, 170px)`, boxShadow: hot ? "4px 4px 0 var(--red)" : "3px 3px 0 var(--ink)" }}
          >
            <span className="block font-bold text-[clamp(10px,2.3cqw,13px)] leading-tight">{n.label}</span>
            {n.sub && <span className={`block text-[clamp(9px,1.9cqw,11px)] leading-tight mt-0.5 ${hot ? "text-white/80" : "text-ink-3"}`}>{n.sub}</span>}
          </button>
        );
      })}
      {d.edges.map((e, i) => {
        if (!e.label) return null;
        const { x1, y1, x2, y2 } = ends(e);
        return (
          <span
            key={`l${i}`}
            className="absolute -translate-x-1/2 -translate-y-[160%] bg-white border border-ink px-1 font-mono text-[clamp(8px,1.8cqw,10px)] leading-tight whitespace-nowrap"
            style={{ left: `${(x1 + x2) / 2}%`, top: `${(y1 + y2) / 2}%` }}
          >
            {e.label}
          </span>
        );
      })}
      {active && node(active)?.sub && <span className="sr-only">{node(active).sub}</span>}
    </div>
  );
}

/* ───────────── layers ───────────── */

function Layers({ d }: { d: Extract<Diagram, { type: "layers" }> }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="w-full flex flex-col items-center gap-1.5">
      {d.title && <span className="font-display text-xs tracking-widest">{d.title}</span>}
      {d.layers.map((l, i) => {
        const hot = open === i;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(hot ? null : i);
            }}
            className={`relative w-full border-[2.5px] border-ink text-left px-3 py-1.5 transition-all ${hot ? "bg-ink text-white" : i % 2 ? "bg-white" : "bg-paper"}`}
            style={{ width: `${100 - Math.abs(i - (d.layers.length - 1) / 2) * 6}%` }}
          >
            {!hot && i % 2 === 0 && <span className="absolute inset-0 tone-dots opacity-[0.12] pointer-events-none" />}
            <span className="relative flex items-center gap-2">
              <span className="font-mono text-[10px] opacity-70">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-bold text-[clamp(11px,2.4cqw,14px)]">{l.label}</span>
              {l.detail && <span className="ml-auto text-[10px] font-mono">{hot ? "−" : "+"}</span>}
            </span>
            {hot && l.detail && <span className="relative block text-[clamp(10px,2.2cqw,13px)] mt-1 leading-snug text-white/90">{l.detail}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────── compare ───────────── */

function Compare({ d }: { d: Extract<Diagram, { type: "compare" }> }) {
  const Side = ({ s, dark }: { s: { title: string; points: string[] }; dark?: boolean }) => (
    <div className={`flex-1 border-[2.5px] border-ink p-2.5 ${dark ? "bg-ink text-white" : "bg-white"}`}>
      <div className="font-display text-[clamp(11px,2.6cqw,15px)] mb-1.5 leading-tight">{s.title}</div>
      <ul className="space-y-1">
        {s.points.map((p, i) => (
          <li key={i} className="text-[clamp(10px,2.2cqw,13px)] leading-snug flex gap-1.5">
            <span className="mt-[5px] w-1.5 h-1.5 shrink-0 bg-current" />
            <span>
              <RichText text={p} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="relative w-full flex gap-3 items-stretch">
      <Side s={d.left} />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 font-display text-white bg-red w-9 h-9 grid place-items-center rotate-[-8deg] border-2 border-ink text-sm">VS</span>
      <Side s={d.right} dark />
    </div>
  );
}

/* ───────────── steps (derivations, procedures) ───────────── */

function Steps({ d }: { d: Extract<Diagram, { type: "steps" }> }) {
  const [shown, setShown] = useState(1);
  return (
    <div className="w-full">
      <ol className="space-y-1.5">
        {d.steps.map((s, i) => (
          <li
            key={i}
            className={`flex gap-2 items-start transition-all duration-300 ${i < shown ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}
            aria-hidden={i >= shown}
          >
            <span className={`shrink-0 font-display w-6 h-6 grid place-items-center text-xs ${i === shown - 1 ? "bg-red text-white" : "bg-ink text-white"}`}>{i + 1}</span>
            <div className="flex-1 border-l-[2.5px] border-ink pl-2">
              <div className="font-bold text-[clamp(11px,2.4cqw,14px)] leading-snug">
                <RichText text={s.label} />
              </div>
              {s.math && <div className="font-serif italic text-[clamp(12px,2.8cqw,16px)] my-0.5 bg-paper px-2 py-1 inline-block border border-ink/30">{prettyMath(s.math)}</div>}
              {s.note && <div className="text-[clamp(10px,2.1cqw,12px)] text-ink-3 leading-snug">{s.note}</div>}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex gap-2 items-center">
        {shown < d.steps.length ? <StepButton onClick={() => setShown((n) => n + 1)}>NEXT STEP ▸</StepButton> : <StepButton onClick={() => setShown(1)}>↺ REPLAY</StepButton>}
        <span className="font-mono text-[10px] text-ink-3">
          {shown}/{d.steps.length}
        </span>
      </div>
    </div>
  );
}

/* ───────────── bars (numbers from a verified quote only) ───────────── */

function Bars({ d }: { d: Extract<Diagram, { type: "bars" }> }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 120);
    return () => clearTimeout(t);
  }, []);
  const max = Math.max(...d.bars.map((b) => b.value)) || 1;
  return (
    <div className="w-full space-y-1.5">
      {d.bars.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-[32%] text-right text-[clamp(10px,2.2cqw,13px)] font-bold leading-tight">{b.label}</span>
          <div className="flex-1 h-6 border-2 border-ink bg-white relative">
            <div
              className={`h-full transition-[width] duration-700 ease-out ${b.highlight ? "bg-ink" : "tone-dots-lg"}`}
              style={{ width: grown ? `${(b.value / max) * 100}%` : "0%", transitionDelay: `${i * 90}ms` }}
            />
          </div>
          <span className="w-14 font-mono text-[clamp(10px,2.2cqw,12px)]">
            {b.value}
            {d.unit ? <span className="text-ink-3"> {d.unit}</span> : null}
          </span>
        </div>
      ))}
      <div className="text-[10px] font-mono text-ink-3 flex items-center gap-1 justify-end">
        values quoted from the paper <RefChips refs={[d.claimId]} />
      </div>
    </div>
  );
}

/* ───────────── cycle ───────────── */

function Cycle({ d }: { d: Extract<Diagram, { type: "cycle" }> }) {
  const [at, setAt] = useState(0);
  const n = d.nodes.length;
  return (
    <div className="w-full">
      <div className="relative w-full mx-auto aspect-square max-w-[300px]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="34" fill="none" stroke={INK} strokeWidth="1.6" strokeDasharray="4 3" />
          {d.nodes.map((_, i) => {
            const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
            const x = f(50 + Math.cos(a) * 34);
            const y = f(50 + Math.sin(a) * 34);
            return <path key={i} d={`M${x} ${y} l${f(-Math.sin(a) * 4 - Math.cos(a) * 2)} ${f(Math.cos(a) * 4 - Math.sin(a) * 2)}`} stroke={INK} strokeWidth="2" />;
          })}
        </svg>
        {d.nodes.map((node, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const hot = i === at;
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAt(i);
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-[34%] border-[2.5px] border-ink px-1 py-1 text-center transition-all ${hot ? "bg-ink text-white scale-110 z-10" : "bg-white"}`}
              style={{ left: `${f(50 + Math.cos(a) * 36)}%`, top: `${f(50 + Math.sin(a) * 36)}%` }}
            >
              <span className="block text-[clamp(9px,2.1cqw,12px)] font-bold leading-tight">{node.label}</span>
            </button>
          );
        })}
        <div className="absolute inset-[30%] grid place-items-center text-center text-[clamp(9px,2cqw,12px)] leading-snug px-1">{d.nodes[at].sub ?? ""}</div>
      </div>
      <div className="flex justify-center mt-1">
        <StepButton onClick={() => setAt((at + 1) % n)}>NEXT ▸</StepButton>
      </div>
    </div>
  );
}

/* ───────────── network ───────────── */

function Network({ d }: { d: Extract<Diagram, { type: "network" }> }) {
  const [wave, setWave] = useState(-1);
  useEffect(() => {
    if (wave < 0 || wave >= d.layers.length) return;
    const t = setTimeout(() => setWave((w) => (w + 1 >= d.layers.length ? -1 : w + 1)), 420);
    return () => clearTimeout(t);
  }, [wave, d.layers.length]);
  const L = d.layers.length;
  const pts = d.layers.map((count, li) => Array.from({ length: count }, (_, ni) => ({ x: 8 + (li / (L - 1)) * 84, y: ((ni + 1) / (count + 1)) * 100 })));
  return (
    <div className="w-full">
      <svg className="w-full h-[150px]" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Neural network with layers of ${d.layers.join(", ")} units`}>
        {pts.slice(0, -1).map((layer, li) =>
          layer.flatMap((a, ai) =>
            pts[li + 1].map((b, bi) => (
              <line
                key={`${li}-${ai}-${bi}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={wave === li + 1 ? "var(--red)" : INK}
                strokeWidth={wave === li + 1 ? 1.8 : 0.9}
                vectorEffect="non-scaling-stroke"
                opacity={wave === li + 1 ? 1 : 0.5}
              />
            )),
          ),
        )}
        {pts.map((layer, li) =>
          layer.map((p, ni) => (
            <ellipse key={`${li}-${ni}`} cx={p.x} cy={p.y} rx="3.2" ry="5" fill={wave === li ? INK : "#fff"} stroke={INK} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          )),
        )}
      </svg>
      <div className="flex justify-between text-[10px] font-mono px-1">
        {d.layers.map((_, i) => (
          <span key={i} className="text-center flex-1">
            {d.labels?.[i] ?? ""}
          </span>
        ))}
      </div>
      <div className="flex justify-center mt-1">
        <StepButton onClick={() => setWave(0)}>▶ FORWARD PASS</StepButton>
      </div>
    </div>
  );
}

/* ───────────── equation ───────────── */

function Equation({ d }: { d: Extract<Diagram, { type: "equation" }> }) {
  const [hot, setHot] = useState<number | null>(null);
  return (
    <div className="w-full text-center">
      <div className="font-serif italic text-[clamp(16px,4.4cqw,28px)] py-2 px-3 border-y-[3px] border-ink bg-white inline-block">{prettyMath(d.expression)}</div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-left">
        {d.parts.map((p, i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot(null)}
            onClick={(e) => e.stopPropagation()}
            className={`flex gap-2 items-baseline border-2 border-ink px-2 py-1 transition-colors ${hot === i ? "bg-ink text-white" : "bg-white"}`}
          >
            <span className="font-serif italic font-bold text-[clamp(12px,2.8cqw,16px)] shrink-0">{prettyMath(p.symbol)}</span>
            <span className="text-[clamp(10px,2.2cqw,12px)] leading-snug">{p.meaning}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────── sequence (scenarios, protocols, attacks) ───────────── */

function Sequence({ d }: { d: Extract<Diagram, { type: "sequence" }> }) {
  const [shown, setShown] = useState(d.messages.length);
  const col = (a: string) => ((d.actors.indexOf(a) + 0.5) / d.actors.length) * 100;
  return (
    <div className="w-full">
      <div className="flex">
        {d.actors.map((a, i) => (
          <div key={a} className="flex-1 text-center">
            <span className={`inline-block border-[2.5px] border-ink px-2 py-0.5 font-bold text-[clamp(10px,2.3cqw,13px)] ${i === 0 ? "bg-ink text-white" : "bg-white"}`}>{a}</span>
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: d.messages.length * 34 + 8 }}>
        {d.actors.map((a) => (
          <div key={a} className="absolute top-0 bottom-0 border-l-2 border-dashed border-ink/60" style={{ left: `${col(a)}%` }} />
        ))}
        {d.messages.slice(0, shown).map((m, i) => {
          const x1 = col(m.from);
          const x2 = col(m.to);
          const left = Math.min(x1, x2);
          return (
            <div key={i} className="absolute ink-in" style={{ top: i * 34 + 6, left: `${left}%`, width: `${Math.max(Math.abs(x2 - x1), 8)}%` }}>
              <div className="text-[clamp(9px,2cqw,11px)] text-center leading-tight px-1 truncate" title={m.text}>
                {m.text}
              </div>
              <div className={`relative h-[2.5px] bg-ink ${i === shown - 1 ? "bg-red" : ""}`}>
                <span className={`absolute -top-[5px] ${x2 >= x1 ? "right-0" : "left-0 rotate-180"} border-y-[6px] border-y-transparent border-l-[9px] border-l-current`} style={{ color: i === shown - 1 ? "var(--red)" : "var(--ink)" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 justify-center">
        <StepButton onClick={() => setShown((s) => (s >= d.messages.length ? 1 : s + 1))}>{shown >= d.messages.length ? "↺ REPLAY" : "NEXT ▸"}</StepButton>
      </div>
    </div>
  );
}

export function DiagramView({ diagram }: { diagram: Diagram }) {
  switch (diagram.type) {
    case "flow":
      return <Flow d={diagram} />;
    case "layers":
      return <Layers d={diagram} />;
    case "compare":
      return <Compare d={diagram} />;
    case "steps":
      return <Steps d={diagram} />;
    case "bars":
      return <Bars d={diagram} />;
    case "cycle":
      return <Cycle d={diagram} />;
    case "network":
      return <Network d={diagram} />;
    case "equation":
      return <Equation d={diagram} />;
    case "sequence":
      return <Sequence d={diagram} />;
  }
}
