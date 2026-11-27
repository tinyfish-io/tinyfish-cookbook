import type { SceneId } from "@/lib/types";

// Reusable panel backgrounds: environments (classroom, lab…) and manga effects
// (speed lines, focus burst, screentone moods). Pure SVG/CSS so they cost nothing to ship.

const INK = "var(--ink)";

// Rounded so server and browser trig produce identical markup (no hydration drift).
const f = (n: number) => Math.round(n * 100) / 100;

function seeded(seed: number) {
  let s = seed % 2147483647 || 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function SpeedLines({ seed }: { seed: number }) {
  const r = seeded(seed);
  return (
    <g stroke={INK} strokeLinecap="round">
      {Array.from({ length: 46 }, (_, i) => {
        const y = r() * 300;
        const len = 120 + r() * 260;
        const x = r() * 400 - 60;
        return <path key={i} d={`M${x} ${y} l${len} ${-len * 0.18}`} strokeWidth={0.6 + r() * 2.4} opacity={0.75} />;
      })}
    </g>
  );
}

function FocusBurst({ seed, dark = false }: { seed: number; dark?: boolean }) {
  const r = seeded(seed);
  const rays = 72;
  return (
    <g>
      {dark && <rect width="400" height="300" fill={INK} />}
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2 + r() * 0.05;
        const inner = 70 + r() * 40;
        const w = 0.012 + r() * 0.02;
        const x1 = f(200 + Math.cos(a - w) * inner);
        const y1 = f(150 + Math.sin(a - w) * inner * 0.8);
        const x2 = f(200 + Math.cos(a) * 420);
        const y2 = f(150 + Math.sin(a) * 420);
        const x3 = f(200 + Math.cos(a + w) * inner);
        const y3 = f(150 + Math.sin(a + w) * inner * 0.8);
        return <path key={i} d={`M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} Z`} fill={dark ? "#fff" : INK} opacity={dark ? 0.85 : 1} />;
      })}
    </g>
  );
}

function Classroom() {
  return (
    <g>
      <rect x="20" y="30" width="360" height="170" fill={INK} />
      <rect x="20" y="30" width="360" height="170" fill="none" stroke={INK} strokeWidth="6" />
      <g stroke="#fff" strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round">
        <path d="M50 70 q30 -20 60 0 t60 0" />
        <path d="M60 110 l80 0 M60 130 l50 0" />
        <path d="M230 60 l0 100 l120 0" />
        <path d="M240 140 q30 -60 50 -30 t50 -50" />
        <text x="250" y="92" fill="#fff" stroke="none" fontFamily="var(--font-letter)" fontSize="16">
          f(x)
        </text>
      </g>
      <rect x="10" y="200" width="380" height="10" fill={INK} />
      <rect x="0" y="210" width="400" height="90" fill="url(#scene-tone)" opacity="0.5" />
    </g>
  );
}

function Lab() {
  return (
    <g fill="none" stroke={INK} strokeWidth="2.5">
      <path d="M0 210 L400 210" strokeWidth="4" />
      {[30, 90, 300, 350].map((x, i) => (
        <g key={x}>
          <path d={`M${x} ${210 - 30 - i * 6} l0 -20 l14 0 l0 20 l14 34 l-42 0 Z`} fill="#fff" />
          <path d={`M${x - 10} ${206} l42 0 l-8 -16 l-26 0 Z`} fill="url(#scene-tone)" stroke="none" />
        </g>
      ))}
      <g opacity="0.55" strokeWidth="1.8">
        <rect x="250" y="40" width="90" height="62" fill="#fff" />
        <path d="M258 90 l16 -22 l16 12 l16 -30 l24 22" />
        <path d="M60 40 l0 40 M50 40 l20 0 M120 30 l0 50 M110 30 l20 0" />
      </g>
      <rect x="0" y="210" width="400" height="90" fill="url(#scene-lines)" stroke="none" opacity="0.6" />
    </g>
  );
}

function Library() {
  const r = seeded(11);
  return (
    <g>
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect x="0" y={20 + row * 90} width="400" height="6" fill={INK} />
          {Array.from({ length: 26 }, (_, i) => {
            const w = 8 + r() * 10;
            const h = 50 + r() * 26;
            const x = i * 15.5;
            return (
              <rect key={i} x={x} y={20 + row * 90 - h + 90} width={w} height={h - 6} fill={r() > 0.6 ? INK : "#fff"} stroke={INK} strokeWidth="1.6" />
            );
          })}
        </g>
      ))}
      <rect width="400" height="300" fill="url(#scene-tone)" opacity="0.25" />
    </g>
  );
}

function City() {
  const r = seeded(5);
  return (
    <g>
      <rect width="400" height="300" fill={INK} />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={r() * 400} cy={r() * 120} r={r() * 1.4 + 0.3} fill="#fff" opacity={0.8} />
      ))}
      <circle cx="320" cy="60" r="26" fill="#fff" />
      <circle cx="330" cy="54" r="24" fill={INK} />
      {Array.from({ length: 14 }, (_, i) => {
        const w = 22 + r() * 30;
        const h = 80 + r() * 120;
        const x = i * 30 - 10;
        return (
          <g key={i}>
            <rect x={x} y={300 - h} width={w} height={h} fill="#141416" stroke="#fff" strokeWidth="1.2" />
            {Array.from({ length: Math.floor(h / 16) }, (_, j) =>
              r() > 0.55 ? <rect key={j} x={x + 5 + (j % 2) * 9} y={300 - h + 8 + j * 14} width="5" height="6" fill="#fff" opacity="0.85" /> : null,
            )}
          </g>
        );
      })}
    </g>
  );
}

function Storm({ seed }: { seed: number }) {
  const r = seeded(seed);
  return (
    <g>
      <rect width="400" height="300" fill={INK} />
      {Array.from({ length: 70 }, (_, i) => {
        const x = r() * 440;
        const y = r() * 300;
        return <path key={i} d={`M${x} ${y} l-18 46`} stroke="#fff" strokeWidth={0.8 + r()} opacity={0.5} />;
      })}
      <path d="M250 0 L226 90 L252 90 L210 200 L240 120 L216 120 L240 0 Z" fill="#fff" />
    </g>
  );
}

function Space({ seed }: { seed: number }) {
  const r = seeded(seed);
  return (
    <g>
      <rect width="400" height="300" fill={INK} />
      {Array.from({ length: 120 }, (_, i) => (
        <circle key={i} cx={r() * 400} cy={r() * 300} r={r() * 1.5 + 0.2} fill="#fff" opacity={0.4 + r() * 0.6} />
      ))}
      <ellipse cx="300" cy="230" rx="140" ry="26" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
      <circle cx="300" cy="230" r="44" fill="#fff" />
      <circle cx="300" cy="230" r="44" fill="url(#scene-tone)" />
    </g>
  );
}

function Grid() {
  return (
    <g>
      <rect width="400" height="300" fill="url(#scene-grid)" />
      <g fill="none" stroke={INK} strokeWidth="2" opacity="0.35">
        <path d="M30 260 Q140 40 380 70" />
        <path d="M30 40 L30 270 L390 270" strokeWidth="2.5" />
      </g>
      <text x="300" y="250" fontFamily="var(--font-letter)" fontSize="22" fill={INK} opacity="0.3">
        ∑ ∫ ∂
      </text>
    </g>
  );
}

function Cells({ seed }: { seed: number }) {
  const r = seeded(seed);
  return (
    <g>
      {Array.from({ length: 16 }, (_, i) => {
        const cx = r() * 400;
        const cy = r() * 300;
        const rad = 20 + r() * 40;
        return (
          <g key={i} opacity={0.55}>
            <ellipse cx={cx} cy={cy} rx={rad} ry={rad * 0.8} fill="#fff" stroke={INK} strokeWidth="2" />
            <circle cx={cx + rad * 0.2} cy={cy} r={rad * 0.28} fill="url(#scene-tone)" stroke={INK} strokeWidth="1.5" />
          </g>
        );
      })}
    </g>
  );
}

function Circuit({ seed }: { seed: number }) {
  const r = seeded(seed);
  return (
    <g stroke={INK} strokeWidth="2" fill="none" opacity="0.4">
      {Array.from({ length: 22 }, (_, i) => {
        const x = Math.round(r() * 20) * 20;
        const y = Math.round(r() * 15) * 20;
        const dx = (r() > 0.5 ? 1 : -1) * (40 + Math.round(r() * 4) * 20);
        const dy = (r() > 0.5 ? 1 : -1) * Math.round(r() * 3) * 20;
        return (
          <g key={i}>
            <path d={`M${x} ${y} l${dx} 0 l0 ${dy}`} />
            <circle cx={x + dx} cy={y + dy} r="4" fill="#fff" />
            <rect x={x - 4} y={y - 4} width="8" height="8" fill={INK} />
          </g>
        );
      })}
    </g>
  );
}

function Sparkle({ seed }: { seed: number }) {
  const r = seeded(seed);
  return (
    <g fill={INK}>
      <rect width="400" height="300" fill="url(#scene-tone)" opacity="0.18" />
      {Array.from({ length: 16 }, (_, i) => {
        const x = r() * 400;
        const y = r() * 300;
        const s = 3 + r() * 9;
        return <path key={i} d={`M${x} ${y - s} L${x + s * 0.25} ${y - s * 0.25} L${x + s} ${y} L${x + s * 0.25} ${y + s * 0.25} L${x} ${y + s} L${x - s * 0.25} ${y + s * 0.25} L${x - s} ${y} L${x - s * 0.25} ${y - s * 0.25} Z`} />;
      })}
    </g>
  );
}

export function Scene({ id, seed = 1, className }: { id: SceneId; seed?: number; className?: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <pattern id="scene-tone" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.3" fill="var(--ink)" />
        </pattern>
        <pattern id="scene-lines" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 L0 8" stroke="var(--ink)" strokeWidth="1.2" />
        </pattern>
        <pattern id="scene-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 L0 0 L0 20" fill="none" stroke="var(--ink)" strokeWidth="0.6" opacity="0.35" />
        </pattern>
        <radialGradient id="scene-fade" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`halftone-mask-${seed}`}>
          <rect width="400" height="300" fill="url(#scene-fade)" />
        </mask>
      </defs>
      <rect width="400" height="300" fill="#fff" />
      {id === "classroom" && <Classroom />}
      {id === "lab" && <Lab />}
      {id === "library" && <Library />}
      {id === "city" && <City />}
      {id === "speed" && <SpeedLines seed={seed} />}
      {id === "focus" && <FocusBurst seed={seed} />}
      {id === "storm" && <Storm seed={seed} />}
      {id === "space" && <Space seed={seed} />}
      {id === "grid" && <Grid />}
      {id === "cells" && <Cells seed={seed} />}
      {id === "circuit" && <Circuit seed={seed} />}
      {id === "sparkle" && <Sparkle seed={seed} />}
      {id === "halftone" && (
        <g>
          <rect width="400" height="300" fill="url(#scene-tone)" />
          <rect width="400" height="300" fill="url(#scene-fade)" />
        </g>
      )}
    </svg>
  );
}

/** Scenes drawn mostly in black, so lettering on them needs white boxes. */
export const DARK_SCENES: SceneId[] = ["city", "storm", "space"];
