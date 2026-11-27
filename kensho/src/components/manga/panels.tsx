"use client";

import type { CastMember, Panel } from "@/lib/types";
import { Character } from "./characters";
import { DARK_SCENES, Scene } from "./scenes";
import { Bubble, NarrationBox, RefChips, RichText } from "./lettering";
import { DiagramView } from "./diagrams";
import { useReader } from "./reader-context";
import type { SlotKind } from "./layout";

function Sfx({ text, seed }: { text: string; seed: number }) {
  const right = seed % 2 === 0;
  return (
    <span
      aria-hidden
      className={`absolute z-[5] font-display text-[clamp(22px,9cqw,56px)] leading-none select-none ${right ? "right-[5%] top-[46%] rotate-[10deg]" : "left-[5%] top-[44%] -rotate-[12deg]"}`}
      style={{ color: "#fff", WebkitTextStroke: "3px var(--ink)", paintOrder: "stroke fill", letterSpacing: "0.02em" }}
    >
      {text}
    </span>
  );
}

/** A character sized by the height available to it, anchored to the panel floor. */
function Figure({ member, side, maxW }: { member: CastMember; side: "left" | "right"; maxW: string }) {
  return (
    <div className={`absolute bottom-0 h-full flex items-end ${side === "left" ? "left-[-1%] justify-start" : "right-[-1%] justify-end"} pointer-events-none`} style={{ maxWidth: maxW }}>
      <Character id={member.character} expression={member.expression} pose={member.pose} flip={side === "right"} className="h-full w-auto max-w-full" />
    </div>
  );
}

function DialoguePanel({ panel, kind, seed }: { panel: Extract<Panel, { kind: "dialogue" }>; kind: SlotKind; seed: number }) {
  const wide = kind === "wide";
  const solo = panel.cast.length === 1;
  // With one character, alternate which side they stand on.
  const soloSide: "left" | "right" = seed % 2 ? "left" : "right";
  const sideOf = (speaker: string): "left" | "right" => {
    if (solo) return panel.cast[0].character === speaker ? soloSide : soloSide === "left" ? "right" : "left";
    return panel.cast[0].character === speaker ? "left" : "right";
  };
  const figures = (maxW: string) =>
    panel.cast.map((m, i) => <Figure key={i} member={m} side={solo ? soloSide : i === 0 ? "left" : "right"} maxW={maxW} />);
  const scene = <Scene id={panel.scene} seed={seed} className={`absolute inset-0 w-full h-full ${DARK_SCENES.includes(panel.scene) ? "" : "opacity-60"}`} />;

  if (wide) {
    // Cinematic strip: cast on both edges, dialogue between them.
    return (
      <div className="relative w-full h-full min-h-full">
        {scene}
        <div className="absolute inset-x-0 bottom-0 top-[6%]">{figures("30%")}</div>
        {panel.sfx && <Sfx text={panel.sfx} seed={seed} />}
        <div className="relative z-10 flex flex-col justify-center gap-[clamp(14px,3cqw,24px)] min-h-full px-[26%] py-[6%]">
          {panel.lines.map((l, i) => (
            <Bubble key={i} line={l} side={i % 2 ? "right" : "left"} delay={i * 140} />
          ))}
        </div>
      </div>
    );
  }

  // Bubbles on top; the cast fills whatever height is left, so tall panels get tall figures.
  return (
    <div className="relative w-full h-full min-h-full flex flex-col">
      {scene}
      {panel.sfx && <Sfx text={panel.sfx} seed={seed} />}
      <div className="relative z-10 flex flex-col gap-[clamp(14px,4cqw,26px)] px-[5%] pt-[12%] pb-[2%]">
        {panel.lines.map((l, i) => (
          <Bubble key={i} line={l} side={sideOf(l.speaker)} delay={i * 140} />
        ))}
      </div>
      <div className="relative flex-1" style={{ minHeight: solo ? "46cqw" : "40cqw" }}>
        {figures(solo ? "86%" : "52%")}
      </div>
    </div>
  );
}

function NarrationPanel({ panel, seed }: { panel: Extract<Panel, { kind: "narration" }>; seed: number }) {
  const dark = DARK_SCENES.includes(panel.scene);
  return (
    <div className="relative w-full h-full min-h-[22cqw]">
      <Scene id={panel.scene} seed={seed} className="absolute inset-0 w-full h-full" />
      {panel.cast?.[0] && (
        <div className="absolute right-0 bottom-0 h-[78%] w-[40%]">
          <Figure member={panel.cast[0]} side="right" maxW="100%" />
        </div>
      )}
      <div className={`relative z-10 p-[5%] ${panel.cast?.length ? "pr-[40%] pb-[22cqw]" : ""}`}>
        <NarrationBox dark={dark} className={seed % 2 ? "-rotate-[0.6deg]" : "rotate-[0.5deg]"}>
          <RichText text={panel.text} />
          <RefChips refs={panel.refs} light={dark} />
        </NarrationBox>
      </div>
    </div>
  );
}

function DiagramPanel({ panel }: { panel: Extract<Panel, { kind: "diagram" }> }) {
  return (
    <div className="relative w-full h-full min-h-full bg-white flex flex-col">
      <div className="absolute inset-0 tone-fade opacity-[0.08] pointer-events-none" />
      <div className="relative flex items-center gap-2 px-[5%] pt-[4%]">
        <span className="bg-ink text-white font-display text-[10px] tracking-[0.2em] px-2 py-0.5">図解 FIGURE</span>
        <span className="h-[2px] flex-1 bg-ink" />
      </div>
      <div className="relative flex-1 grid place-items-center px-[6%] py-[4%]">
        <DiagramView diagram={panel.diagram} />
      </div>
      {panel.caption && (
        <div className="relative mx-[5%] mb-[5%] border-t-2 border-ink pt-1.5 text-[clamp(11px,2.4cqw,14px)] leading-snug">
          <RichText text={panel.caption} />
          <RefChips refs={panel.refs} />
        </div>
      )}
    </div>
  );
}

function ConceptPanel({ panel, seed }: { panel: Extract<Panel, { kind: "concept" }>; seed: number }) {
  const { openTerm } = useReader();
  return (
    <div className="relative w-full h-full min-h-full">
      <Scene id="focus" seed={seed} className="absolute inset-0 w-full h-full opacity-90" />
      <div className="relative z-10 flex flex-col items-center justify-center text-center gap-[3cqw] p-[7%] min-h-full">
        <span className="bg-white border-2 border-ink font-display text-[10px] tracking-[0.25em] px-2 py-0.5">用語 · KEY TERM</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openTerm({ term: panel.term, definition: panel.definition });
          }}
          className="bg-ink text-white font-display px-[4cqw] py-[1.6cqw] text-[clamp(18px,7cqw,44px)] leading-[1.05] -rotate-2 shadow-[6px_6px_0_var(--red)] hover:-rotate-1 transition-transform"
          title="Save or read this term"
        >
          {panel.term}
        </button>
        <div className="bg-white border-[2.5px] border-ink px-[4cqw] py-[2cqw] max-w-[92%] text-[clamp(12px,2.8cqw,16px)] leading-snug">
          <RichText text={panel.definition} terms={false} />
          <RefChips refs={panel.refs} />
        </div>
        {panel.analogy && (
          <div className="relative bg-white border-2 border-dashed border-ink px-[3cqw] py-[1.6cqw] max-w-[86%] lettering text-[clamp(11px,2.5cqw,15px)]">
            <span className="absolute -top-2.5 left-3 bg-white px-1 font-sans text-[10px] font-black tracking-[0.12em]">喩 ANALOGY</span>
            {panel.analogy}
          </div>
        )}
      </div>
    </div>
  );
}

function ClaimPanel({ panel, seed }: { panel: Extract<Panel, { kind: "claim" }>; seed: number }) {
  const { claims, sectionHeading, openClaim } = useReader();
  const c = claims.get(panel.claimId);
  if (!c) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openClaim(c.id);
      }}
      className="relative w-full h-full min-h-full text-left bg-paper block group"
    >
      <div className="absolute inset-0 tone-lines opacity-[0.06]" />
      <div className="relative p-[6%] pb-[7%] flex flex-col justify-center gap-[2.4cqw] min-h-full">
        <div className="flex items-center gap-2">
          <span className="bg-ink text-white font-display text-[10px] tracking-[0.2em] px-2 py-0.5">論文より · FROM THE PAPER</span>
          <span className="font-mono text-[10px] text-ink-3 truncate">
            {c.sectionId}
            {sectionHeading(c.sectionId) ? ` · ${sectionHeading(c.sectionId)}` : ""}
          </span>
        </div>
        <blockquote className="relative font-serif text-[clamp(13px,3.3cqw,20px)] leading-snug pl-[5cqw] pr-[18cqw]">
          <span className="absolute left-0 -top-[1.5cqw] font-display text-[clamp(26px,9cqw,56px)] leading-none">“</span>
          {c.quote}
        </blockquote>
        <p className="text-[clamp(11px,2.5cqw,14px)] leading-snug border-l-[3px] border-ink pl-2.5 pr-[16cqw]">
          <span className="font-bold">In plain words: </span>
          {c.statement}
        </p>
        {panel.reaction && (
          <div className="mt-[3cqw] self-end max-w-[70%] lettering text-[clamp(11px,2.5cqw,15px)] bg-white border-[2.5px] border-ink rounded-[46%/50%] px-4 py-2 text-center">
            {panel.reaction}
          </div>
        )}
      </div>
      <span
        className={`absolute right-[5%] top-[14%] w-[15cqw] h-[15cqw] max-w-[84px] max-h-[84px] min-w-[52px] min-h-[52px] rounded-full grid place-items-center text-center stamp-in ${
          c.verified ? "border-[3px] border-red text-red" : "border-[3px] border-ink-3 text-ink-3 border-dashed"
        }`}
        style={{ animationDelay: `${200 + (seed % 5) * 40}ms` }}
        title={c.verified ? "This quote was found word-for-word in the retrieved paper text." : "This excerpt could not be matched exactly in the retrieved text; treat it as a paraphrase."}
      >
        <span className="leading-none">
          <span className="block font-display text-[clamp(14px,4cqw,22px)]">{c.verified ? "検証" : "要確認"}</span>
          <span className="block font-mono text-[8px] tracking-wider mt-0.5">{c.verified ? "VERIFIED" : "UNVERIFIED"}</span>
        </span>
      </span>
    </button>
  );
}

export function PanelView({ panel, kind, seed }: { panel: Panel; kind: SlotKind; seed: number }) {
  switch (panel.kind) {
    case "dialogue":
      return <DialoguePanel panel={panel} kind={kind} seed={seed} />;
    case "narration":
      return <NarrationPanel panel={panel} seed={seed} />;
    case "diagram":
      return <DiagramPanel panel={panel} />;
    case "concept":
      return <ConceptPanel panel={panel} seed={seed} />;
    case "claim":
      return <ClaimPanel panel={panel} seed={seed} />;
  }
}
