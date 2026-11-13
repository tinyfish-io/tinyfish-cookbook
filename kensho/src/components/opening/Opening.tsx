"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Scene } from "@/components/manga/scenes";
import { Sumi } from "@/components/mascot/Sumi";

// First-visit title card: "opening volume one". Hidden before paint for returning readers by
// the inline script in app/layout.tsx; replayable from the footer (/?intro=1).

export const INTRO_KEY = "kensho.intro.v1";
const SOUND_KEY = "kensho.sound";

type Phase = "title" | "playing" | "leaving" | "gone";

const BANDS = [
  { jp: "探す", en: "SEARCH THE RESEARCH WEB", cls: "bg-white text-ink" },
  { jp: "読む", en: "READ THE REAL PAPER", cls: "bg-red text-white" },
  { jp: "わかる", en: "UNDERSTAND IT AS MANGA", cls: "bg-white text-ink" },
];

/* Synthesized, so there are no audio assets to ship. Only ever runs after a click with sound on. */
function useSfx(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const get = () => {
    if (!enabled) return null;
    ctx.current ??= new AudioContext();
    return ctx.current;
  };
  const don = () => {
    const a = get();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.62);
  };
  const whoosh = (delay = 0) => {
    const a = get();
    if (!a) return;
    const t = a.currentTime + delay;
    const len = 0.35;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + len);
    const g = a.createGain();
    g.gain.value = 0.25;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  };
  return { don, whoosh };
}

export function Opening() {
  const [phase, setPhase] = useState<Phase>("title");
  const [sound, setSound] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const sfx = useSfx(sound);

  useEffect(() => {
    try {
      setSound(localStorage.getItem(SOUND_KEY) === "on");
    } catch {}
    // Visible (first visit or replay): lock page scroll and focus the primary action.
    if (getComputedStyle(document.querySelector(".opening")!).display !== "none") {
      document.documentElement.style.overflow = "hidden";
      startRef.current?.focus({ preventScroll: true });
    } else {
      setPhase("gone");
    }
    const ts = timers.current;
    return () => {
      ts.forEach(clearTimeout);
      document.documentElement.style.overflow = "";
    };
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(INTRO_KEY, "seen");
    } catch {}
    document.documentElement.style.overflow = "";
    document.documentElement.dataset.intro = "seen";
    if (window.location.search.includes("intro=1")) window.history.replaceState(null, "", "/");
    setPhase("gone");
    // Hand focus to the thing the user came for.
    requestAnimationFrame(() => (document.getElementById("topic") as HTMLInputElement | null)?.focus({ preventScroll: true }));
  }, []);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const start = () => {
    if (phase !== "title") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase("leaving");
      later(220, finish);
      return;
    }
    setPhase("playing");
    sfx.don();
    sfx.whoosh(0.62);
    later(1500, () => setPhase("leaving"));
    later(2250, finish);
  };

  const skip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setPhase("leaving");
    timers.current.push(window.setTimeout(finish, 260));
  }, [finish]);

  useEffect(() => {
    if (phase === "gone") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, skip]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {}
  };

  if (phase === "gone") return null;
  const playing = phase === "playing";

  return (
    <div
      className={`opening fixed inset-0 z-[100] bg-ink text-white overflow-hidden ${phase === "leaving" ? "opening-leave" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Kenshō opening"
    >
      <Scene id="focus" seed={7} className={`absolute inset-0 w-full h-full invert opacity-[0.18] ${playing ? "opening-zoom" : "opening-drift"}`} />
      <div className="absolute inset-0 tone-dots invert opacity-[0.05] pointer-events-none" />

      {/* Title card */}
      <div className={`relative h-full flex flex-col items-center justify-center px-6 text-center ${playing ? "opening-shake" : ""}`}>
        <div className="op-kicker font-mono text-red text-xs sm:text-sm tracking-[0.35em]">第一巻 · VOL. 01</div>
        <div className="relative mt-3">
          <span aria-hidden className="op-kanji absolute left-1/2 top-1/2 font-display text-[clamp(160px,30vw,360px)] leading-none text-transparent [-webkit-text-stroke:2px_rgba(255,255,255,0.14)] select-none">
            見性
          </span>
          <h1 className="op-title relative font-display text-[clamp(64px,13vw,168px)] leading-[0.86] tracking-[-0.01em]">
            KENSH<span className="text-red">Ō</span>
          </h1>
        </div>
        <p className="op-tag mt-5 text-lg sm:text-2xl font-medium text-white/85 max-w-[30ch]">Research papers, read like manga.</p>

        <div className="op-cta mt-10 flex flex-col items-center gap-4">
          <button
            ref={startRef}
            onClick={start}
            className="group inline-flex items-center gap-3 bg-white text-ink font-display text-lg sm:text-xl tracking-wider px-8 py-4 border-[3px] border-white shadow-[6px_6px_0_var(--red)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[9px_9px_0_var(--red)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
          >
            <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden>
              <path d="M1 1 L15 9 L1 17 Z" fill="currentColor" />
            </svg>
            START READING
          </button>
          <button onClick={skip} className="text-sm font-bold text-white/70 hover:text-white underline-offset-4 hover:underline">
            Skip intro →
          </button>
        </div>

        <div className="op-sumi absolute left-[5%] bottom-[7%] hidden md:flex items-center gap-3">
          {/* Paper-white spotlight so the ink-black fish reads on the dark stage */}
          <div className="relative grid place-items-center w-[150px] h-[150px] rounded-full bg-paper shadow-[0_0_0_6px_rgba(255,255,255,0.08),0_0_60px_rgba(255,255,255,0.18)]">
            <Sumi mode="interactive" size={122} float />
          </div>
          <span className="relative bg-white text-ink border-[2.5px] border-ink rounded-[46%/50%] px-4 py-2.5 lettering text-[15px] max-w-[200px] text-center">Poke me — then let’s find a paper.</span>
        </div>
      </div>

      <button
        onClick={toggleSound}
        aria-pressed={sound}
        className="absolute right-5 bottom-5 flex items-center gap-2 border border-white/30 px-3 py-1.5 font-mono text-[11px] tracking-[0.2em] hover:bg-white hover:text-ink transition-colors"
      >
        <span aria-hidden className="flex items-end gap-[2px] h-3">
          {[5, 9, 12].map((h, i) => (
            <span key={i} className={`w-[3px] ${sound ? "bg-red" : "bg-white/40"}`} style={{ height: sound ? h : 3 }} />
          ))}
        </span>
        SOUND {sound ? "ON" : "OFF"}
      </button>

      {/* Start sequence: SFX slam, ink flash, then three diagonal bands */}
      {playing && (
        <>
          <div aria-hidden className="absolute inset-0 bg-white op-flash pointer-events-none" />
          <div aria-hidden className="absolute inset-0 grid place-items-center pointer-events-none">
            <span className="op-sfx font-display text-[clamp(120px,24vw,300px)] leading-none text-red" style={{ WebkitTextStroke: "6px var(--ink)", paintOrder: "stroke fill" }}>
              ドン!
            </span>
          </div>
          <div aria-hidden className="absolute inset-0 flex flex-col justify-center gap-4 -rotate-[8deg] scale-125 pointer-events-none">
            {BANDS.map((b, i) => (
              <div key={b.en} className={`op-band ${b.cls} border-y-[4px] border-ink py-3 sm:py-5 px-[12vw] flex items-baseline gap-5`} style={{ animationDelay: `${620 + i * 130}ms` }}>
                <span className="font-display text-[clamp(28px,5vw,64px)] leading-none">{b.jp}</span>
                <span className="font-display text-[clamp(22px,4vw,56px)] leading-none whitespace-nowrap">{b.en}</span>
                <span className="font-mono text-xs opacity-60">0{i + 1}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
