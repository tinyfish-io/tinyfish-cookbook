"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Mascot } from "page-mascot";

// Sumi, the ink-fish scout, drawn as page-mascot sprite sheets (scripts/build-mascot.mjs).
//  - "interactive": page-mascot itself — follows the cursor, reacts when poked.
//  - "scouting" / "reading" / "inking": a scripted loop over the same sheets for loading states,
//    so the character stays alive on touch screens and while the user isn't moving the mouse.
//  - "happy" / "dizzy" / "sleepy" / "surprised": a single held expression (success, error, empty).

const DIRECTIONS = "/mascots/sumi-directions.png";
const REACTIONS = "/mascots/sumi-reactions.png";

type Dir = "up-left" | "up" | "up-right" | "left" | "center" | "right" | "down-left" | "down" | "down-right";
type Reaction = "blink" | "heart" | "sparkle" | "surprised" | "wink" | "bashful" | "sleepy" | "dizzy" | "delighted";
const DIR_INDEX: Dir[] = ["up-left", "up", "up-right", "left", "center", "right", "down-left", "down", "down-right"];
const REACTION_INDEX: Reaction[] = ["blink", "heart", "sparkle", "surprised", "wink", "bashful", "sleepy", "dizzy", "delighted"];

export type SumiMode = "interactive" | "scouting" | "reading" | "inking" | "happy" | "dizzy" | "sleepy" | "surprised";

// Each loop is a list of [frame, ms]. Frames are directions unless prefixed with "!".
const LOOPS: Record<"scouting" | "reading" | "inking", [string, number][]> = {
  // Looking around the web for papers.
  scouting: [["left", 700], ["up-left", 500], ["!blink", 140], ["up-right", 600], ["right", 700], ["center", 500], ["!blink", 140], ["down-right", 500]],
  // Reading a page top to bottom, left to right.
  reading: [["up-left", 450], ["up-right", 450], ["left", 450], ["right", 450], ["down-left", 450], ["down-right", 450], ["!blink", 140], ["center", 600]],
  // Concentrating on the drawing, with the odd bright idea.
  inking: [["down", 900], ["down-left", 600], ["!blink", 140], ["down", 700], ["!sparkle", 650], ["down-right", 700]],
};

function cell(index: number) {
  return `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function Sprite({ frame, size }: { frame: string; size: number }) {
  const isReaction = frame.startsWith("!");
  const idx = isReaction ? REACTION_INDEX.indexOf(frame.slice(1) as Reaction) : DIR_INDEX.indexOf(frame as Dir);
  const layer = { position: "absolute" as const, inset: 0, backgroundSize: "300% 300%", backgroundRepeat: "no-repeat" };
  return (
    <span aria-hidden style={{ position: "relative", display: "block", width: size, height: size }}>
      <span style={{ ...layer, backgroundImage: `url(${DIRECTIONS})`, backgroundPosition: cell(isReaction ? 4 : idx), opacity: isReaction ? 0 : 1 }} />
      <span style={{ ...layer, backgroundImage: `url(${REACTIONS})`, backgroundPosition: cell(isReaction ? idx : 0), opacity: isReaction ? 1 : 0 }} />
    </span>
  );
}

function Loop({ name, size }: { name: keyof typeof LOOPS; size: number }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const seq = LOOPS[name];
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setI((n) => (n + 1) % seq.length), seq[i][1]);
    return () => clearTimeout(t);
  }, [i, seq, reduced]);
  return <Sprite frame={reduced ? "center" : seq[i][0]} size={size} />;
}

const HELD: Record<string, string> = { happy: "!delighted", dizzy: "!dizzy", sleepy: "!sleepy", surprised: "!surprised" };

export function Sumi({
  mode = "interactive",
  size = 140,
  label = "Sumi, the ink-fish scout",
  bubble,
  bubbleSide = "right",
  className = "",
  float = mode !== "interactive",
}: {
  mode?: SumiMode;
  size?: number;
  label?: string;
  /** Short line in a manga speech bubble. Keep it factual for loading states. */
  bubble?: ReactNode;
  bubbleSide?: "right" | "left" | "top";
  className?: string;
  /** Gentle swim; disabled automatically for reduced motion. */
  float?: boolean;
}) {
  const art =
    mode === "interactive" ? (
      <Mascot directions={DIRECTIONS} reactions={REACTIONS} size={size} label={label} />
    ) : mode in LOOPS ? (
      <span role="img" aria-label={label}>
        <Loop name={mode as keyof typeof LOOPS} size={size} />
      </span>
    ) : (
      <span role="img" aria-label={label}>
        <Sprite frame={HELD[mode]} size={size} />
      </span>
    );

  return (
    <div className={`relative inline-flex items-center ${bubbleSide === "top" ? "flex-col-reverse" : bubbleSide === "left" ? "flex-row-reverse" : ""} gap-2 ${className}`}>
      <div className={float ? "sumi-float" : undefined}>{art}</div>
      {bubble && (
        <div
          className={`relative bg-white border-[2.5px] border-ink rounded-[46%/50%] px-4 py-2.5 lettering text-[15px] leading-snug text-ink max-w-[260px] text-center ink-in`}
          aria-live="polite"
        >
          {bubble}
          <span
            aria-hidden
            className={`absolute w-3.5 h-3.5 bg-white border-ink ${
              bubbleSide === "right"
                ? "-left-[8px] top-1/2 -translate-y-1/2 rotate-45 border-l-[2.5px] border-b-[2.5px]"
                : bubbleSide === "left"
                  ? "-right-[8px] top-1/2 -translate-y-1/2 rotate-45 border-r-[2.5px] border-t-[2.5px]"
                  : "left-1/2 -bottom-[8px] -translate-x-1/2 rotate-45 border-r-[2.5px] border-b-[2.5px]"
            }`}
          />
        </div>
      )}
    </div>
  );
}
