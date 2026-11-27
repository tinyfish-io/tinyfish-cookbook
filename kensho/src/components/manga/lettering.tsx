"use client";

import { Fragment, type ReactNode } from "react";
import type { Line, Term } from "@/lib/types";
import { useReader } from "./reader-context";
import { CHARACTER_NAMES } from "./characters";

/* ───────────── rich text: emphasis + glossary terms ───────────── */

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function RichText({ text, terms = true }: { text: string; terms?: boolean }) {
  const { glossary, openTerm } = useReader();
  // Split on **bold** / *emphasis* first, then highlight glossary terms inside plain runs.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  const sorted = terms ? [...glossary].sort((a, b) => b.term.length - a.term.length) : [];
  const re = sorted.length ? new RegExp(`\\b(${sorted.map((g) => escapeRe(g.term)).join("|")})\\b`, "gi") : null;

  const withTerms = (s: string, key: string): ReactNode[] => {
    if (!re) return [s];
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of s.matchAll(re)) {
      const term = sorted.find((g) => g.term.toLowerCase() === m[0].toLowerCase()) as Term;
      out.push(s.slice(last, m.index));
      out.push(
        <button
          key={`${key}-${m.index}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openTerm(term);
          }}
          className="underline decoration-dotted decoration-2 underline-offset-[3px] hover:bg-ink hover:text-white transition-colors cursor-help"
          title={term.definition}
        >
          {m[0]}
        </button>,
      );
      last = (m.index ?? 0) + m[0].length;
    }
    out.push(s.slice(last));
    return out;
  };

  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i} className="font-extrabold">
            {withTerms(p.slice(2, -2), `b${i}`)}
          </strong>
        ) : p.startsWith("*") ? (
          <em key={i} className="font-bold not-italic">
            {withTerms(p.slice(1, -1), `e${i}`)}
          </em>
        ) : (
          <Fragment key={i}>{withTerms(p, `t${i}`)}</Fragment>
        ),
      )}
    </>
  );
}

/* ───────────── citation chips ───────────── */

export function RefChips({ refs, light = false }: { refs: string[]; light?: boolean }) {
  const { claims, openClaim } = useReader();
  if (!refs.length) return null;
  return (
    <span className="inline-flex gap-[3px] align-super ml-1 not-italic">
      {refs.map((r) => {
        const c = claims.get(r);
        return (
          <button
            key={r}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openClaim(r);
            }}
            title={c ? `${c.statement}` : r}
            className={`font-mono text-[0.62em] leading-none px-[4px] py-[2px] border transition-colors ${
              light ? "bg-white text-ink border-white hover:bg-red hover:text-white" : "bg-ink text-white border-ink hover:bg-red hover:border-red"
            }`}
          >
            {r}
          </button>
        );
      })}
    </span>
  );
}

/* ───────────── bubbles ───────────── */

export function Bubble({ line, side, delay = 0 }: { line: Line; side: "left" | "right"; delay?: number }) {
  const analogy = line.basis === "analogy";
  const content = (
    <>
      <RichText text={line.text} />
      <RefChips refs={line.refs} />
    </>
  );
  const tail =
    line.style === "thought" ? (
      <span className={`absolute -bottom-5 ${side === "left" ? "left-[18%]" : "right-[18%]"} flex flex-col items-center gap-[3px]`} aria-hidden>
        <span className="block w-3 h-3 rounded-full border-[2.5px] border-ink bg-white" />
        <span className="block w-2 h-2 rounded-full border-2 border-ink bg-white" />
      </span>
    ) : line.style !== "shout" ? (
      <svg
        className={`absolute -bottom-[17px] ${side === "left" ? "left-[22%]" : "right-[22%] -scale-x-100"} w-6 h-5`}
        viewBox="0 0 24 20"
        aria-hidden
      >
        <path d="M2 0 L10 18 L18 0" fill="#fff" stroke="var(--ink)" strokeWidth="2.6" strokeLinejoin="round" strokeDasharray={line.style === "whisper" ? "4 3" : undefined} />
        <path d="M0 0 L22 0" stroke="#fff" strokeWidth="5" />
      </svg>
    ) : null;

  const common = "relative lettering text-ink text-[clamp(12px,2.8cqw,17px)] ink-in";
  const label = (
    <span className="sr-only">
      {CHARACTER_NAMES[line.speaker]}
      {analogy ? " (analogy)" : ""}:{" "}
    </span>
  );

  if (line.style === "shout") {
    return (
      <div className={`${common} max-w-[88%] ${side === "left" ? "self-start" : "self-end"}`} style={{ animationDelay: `${delay}ms` }}>
        <svg className="absolute inset-[-14px] w-[calc(100%+28px)] h-[calc(100%+28px)]" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
          <path
            d="M2 30 L10 22 L4 12 L18 14 L20 3 L32 10 L40 1 L48 9 L58 2 L64 11 L76 4 L78 15 L94 12 L88 23 L98 30 L88 37 L95 48 L80 46 L76 57 L64 50 L56 59 L48 51 L38 58 L32 49 L20 56 L19 45 L5 48 L11 38 Z"
            fill="#fff"
            stroke="var(--ink)"
            strokeWidth="2.8"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
        <p className="relative px-4 py-3 font-black uppercase tracking-wide text-[1.08em] leading-tight text-center">
          {label}
          {content}
        </p>
      </div>
    );
  }

  return (
    <div className={`${common} max-w-[86%] ${side === "left" ? "self-start" : "self-end"}`} style={{ animationDelay: `${delay}ms` }}>
      {analogy && (
        <span className="absolute -top-[11px] left-4 z-10 bg-white border-2 border-ink px-1.5 py-[1px] font-sans text-[10px] font-black tracking-[0.12em] leading-none">
          <span className="mr-1">喩</span>ANALOGY
        </span>
      )}
      <p
        className={`relative bg-white px-[1.25em] py-[0.8em] text-center border-ink ${
          line.style === "thought" ? "border-[2.5px] rounded-[48%]" : line.style === "whisper" ? "border-2 border-dashed rounded-[46%/50%]" : "border-[2.5px] rounded-[46%/50%]"
        } ${analogy ? "shadow-[inset_0_0_0_4px_#fff,inset_0_0_0_5.5px_var(--ink)]" : ""} ${line.style === "whisper" ? "text-[0.92em] italic" : ""}`}
      >
        {label}
        {content}
      </p>
      {tail}
    </div>
  );
}

export function NarrationBox({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div
      className={`relative px-3.5 py-2.5 text-[clamp(12px,2.6cqw,16px)] leading-snug font-medium ink-in ${
        dark ? "bg-ink text-white border-2 border-white" : "bg-white text-ink border-[2.5px] border-ink"
      } ${className}`}
    >
      {children}
    </div>
  );
}
