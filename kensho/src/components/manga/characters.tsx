import type { CharacterId, Expression, Pose } from "@/lib/types";

// Kenshō's reusable cast, drawn as vector ink so they stay on-model in every panel and
// scale crisply at any size. Faces, poses and effects are composed from parts; dialogue
// is never baked into artwork.

const INK = "var(--ink)";
const W = "#fff";
const S = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export const CHARACTER_NAMES: Record<CharacterId, string> = {
  hoshi: "Prof. Hoshi",
  kai: "Kai",
  sumi: "Sumi",
};

/* ───────────── shared face parts ───────────── */

function Eye({ cx, cy, exp, big }: { cx: number; cy: number; exp: Expression; big: boolean }) {
  const rx = big ? 8 : 6.5;
  const ry = big ? 11 : 8.5;
  switch (exp) {
    case "happy":
      return <path d={`M${cx - rx} ${cy + 2} Q${cx} ${cy - ry} ${cx + rx} ${cy + 2}`} fill="none" {...S} strokeWidth={3.6} />;
    case "surprised":
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={rx + 1} ry={ry + 1.5} fill={W} {...S} strokeWidth={2.6} />
          <circle cx={cx} cy={cy + 1} r={2.4} fill={INK} />
        </g>
      );
    case "serious":
      return (
        <g>
          <path d={`M${cx - rx - 1} ${cy - 3} L${cx + rx + 1} ${cy - 5}`} {...S} strokeWidth={3.6} />
          <ellipse cx={cx} cy={cy + 1} rx={rx - 1} ry={ry - 4} fill={INK} />
          <circle cx={cx + 2} cy={cy - 1} r={1.6} fill={W} />
        </g>
      );
    case "smug":
      return (
        <g>
          <path d={`M${cx - rx} ${cy - 1} L${cx + rx} ${cy - 1}`} {...S} strokeWidth={3.6} />
          <path d={`M${cx - rx + 1} ${cy} Q${cx} ${cy + ry} ${cx + rx - 1} ${cy} Z`} fill={INK} />
        </g>
      );
    case "excited":
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={INK} />
          <path d={`M${cx} ${cy - 6} L${cx + 1.6} ${cy - 1.6} L${cx + 6} ${cy} L${cx + 1.6} ${cy + 1.6} L${cx} ${cy + 6} L${cx - 1.6} ${cy + 1.6} L${cx - 6} ${cy} L${cx - 1.6} ${cy - 1.6} Z`} fill={W} />
        </g>
      );
    case "thinking":
      return (
        <g>
          <path d={`M${cx - rx - 1} ${cy - ry + 2} L${cx + rx + 1} ${cy - ry + 1}`} {...S} strokeWidth={3.4} />
          <ellipse cx={cx + 2.5} cy={cy - 1} rx={rx - 1.5} ry={ry - 2.5} fill={INK} />
          <circle cx={cx + 4.5} cy={cy - 4} r={1.8} fill={W} />
        </g>
      );
    case "confused":
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={rx - 0.5} ry={ry - 1} fill={INK} />
          <circle cx={cx - 2} cy={cy - 3} r={2.2} fill={W} />
          <circle cx={cx + 2.2} cy={cy + 3} r={1} fill={W} />
        </g>
      );
    case "worried":
      return (
        <g>
          <ellipse cx={cx} cy={cy + 1} rx={rx - 1} ry={ry - 1.5} fill={INK} />
          <circle cx={cx - 1.5} cy={cy - 2} r={2.2} fill={W} />
          <circle cx={cx + 2} cy={cy + 4} r={1.1} fill={W} />
        </g>
      );
    default:
      return (
        <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: "blink 5s infinite" }}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={INK} />
          <circle cx={cx - 2} cy={cy - 3.5} r={2.6} fill={W} />
          <circle cx={cx + 2.4} cy={cy + 3.5} r={1.2} fill={W} />
        </g>
      );
  }
}

const BROWS: Record<Expression, [number, number, number, number]> = {
  // left inner y, left outer y, right inner y, right outer y (relative)
  neutral: [0, 0, 0, 0],
  happy: [-2, -1, -2, -1],
  excited: [-5, -3, -5, -3],
  surprised: [-8, -6, -8, -6],
  thinking: [0, 0, -6, -3],
  confused: [-4, 0, 2, 0],
  serious: [4, -2, 4, -2],
  smug: [0, 0, -4, -2],
  worried: [-6, 2, -6, 2],
};

function Brows({ y, exp, gap = 18 }: { y: number; exp: Expression; gap?: number }) {
  const [li, lo, ri, ro] = BROWS[exp];
  const lx = 100 - gap;
  const rx = 100 + gap;
  return (
    <g {...S} strokeWidth={3.4} fill="none">
      <path d={`M${lx - 9} ${y + lo} Q${lx} ${y - 3 + (li + lo) / 2} ${lx + 8} ${y + li}`} />
      <path d={`M${rx - 8} ${y + ri} Q${rx} ${y - 3 + (ri + ro) / 2} ${rx + 9} ${y + ro}`} />
    </g>
  );
}

function Mouth({ exp, y }: { exp: Expression; y: number }) {
  switch (exp) {
    case "happy":
      return <path d={`M90 ${y - 2} Q100 ${y + 12} 110 ${y - 2} Z`} fill={INK} {...S} strokeWidth={2.4} />;
    case "excited":
      return (
        <g>
          <path d={`M87 ${y - 3} Q100 ${y + 18} 113 ${y - 3} Z`} fill={INK} {...S} strokeWidth={2.4} />
          <path d={`M93 ${y + 7} Q100 ${y + 3} 107 ${y + 7} Q100 ${y + 12} 93 ${y + 7}`} fill={W} />
        </g>
      );
    case "surprised":
      return <ellipse cx={100} cy={y + 3} rx={4.5} ry={6} fill={INK} />;
    case "thinking":
      return <path d={`M92 ${y + 2} Q97 ${y - 1} 101 ${y + 2} T110 ${y}`} fill="none" {...S} strokeWidth={2.6} />;
    case "confused":
      return <path d={`M90 ${y + 2} Q95 ${y - 2} 100 ${y + 2} T110 ${y + 2}`} fill="none" {...S} strokeWidth={2.6} />;
    case "serious":
      return <path d={`M93 ${y + 2} L107 ${y + 1}`} {...S} strokeWidth={2.8} />;
    case "smug":
      return <path d={`M92 ${y + 2} Q102 ${y + 5} 110 ${y - 3}`} fill="none" {...S} strokeWidth={2.8} />;
    case "worried":
      return <path d={`M92 ${y + 4} Q100 ${y - 3} 108 ${y + 4}`} fill="none" {...S} strokeWidth={2.6} />;
    default:
      return <path d={`M94 ${y + 1} Q100 ${y + 4} 106 ${y + 1}`} fill="none" {...S} strokeWidth={2.6} />;
  }
}

function Blush() {
  return (
    <g stroke={INK} strokeWidth={1.6} strokeLinecap="round">
      {[0, 5, 10].map((d) => (
        <g key={d}>
          <path d={`M${70 + d} 112 l-3 5`} />
          <path d={`M${122 + d} 112 l-3 5`} />
        </g>
      ))}
    </g>
  );
}

/** Manga emotion marks drawn around the head. */
function Effects({ exp }: { exp: Expression }) {
  switch (exp) {
    case "surprised":
      return (
        <g {...S} strokeWidth={3}>
          <path d="M38 52 l-14 -10 M34 74 l-18 -2 M162 52 l14 -10 M166 74 l18 -2 M100 22 l0 -14" />
        </g>
      );
    case "worried":
    case "confused":
      return (
        <g>
          <path d="M150 58 q8 12 0 18 q-8 -6 0 -18 Z" fill={W} {...S} strokeWidth={2.4} />
          {exp === "confused" && (
            <text x="160" y="44" fontFamily="var(--font-display)" fontSize="30" fill={INK}>
              ?
            </text>
          )}
        </g>
      );
    case "excited":
      return (
        <g fill={INK}>
          <path d="M30 50 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3 Z" />
          <path d="M168 40 l2.4 7 7 2.4 -7 2.4 -2.4 7 -2.4 -7 -7 -2.4 7 -2.4 Z" />
        </g>
      );
    case "serious":
      return (
        <g stroke={INK} strokeWidth={1.4} opacity={0.9}>
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M${76 + i * 8} 62 l0 14`} />
          ))}
        </g>
      );
    case "thinking":
      return (
        <g fill={W} {...S} strokeWidth={2.4}>
          <circle cx="162" cy="58" r="4" />
          <circle cx="172" cy="44" r="6" />
        </g>
      );
    default:
      return null;
  }
}

/* ───────────── arms ───────────── */

function Hand({ x, y, r = 0, kind }: { x: number; y: number; r?: number; kind: "point" | "open" | "fist" }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      {kind === "point" && (
        <>
          <rect x={-3} y={-30} width={9} height={24} rx={4.5} fill={W} {...S} strokeWidth={2.8} />
          <path d="M-11 -10 Q-12 6 0 9 Q12 8 12 -6 L12 -12 Q6 -15 -2 -12 Q-10 -15 -11 -10 Z" fill={W} {...S} strokeWidth={2.8} />
        </>
      )}
      {kind === "open" && (
        <>
          <path d="M-12 4 L-14 -16 M-5 2 L-6 -24 M3 2 L4 -24 M11 4 L13 -16" {...S} strokeWidth={8.5} stroke={INK} />
          <path d="M-12 4 L-14 -16 M-5 2 L-6 -24 M3 2 L4 -24 M11 4 L13 -16" stroke={W} strokeWidth={3.2} strokeLinecap="round" />
          <path d="M-14 -4 Q-15 12 0 13 Q15 12 14 -4 Q0 -8 -14 -4 Z" fill={W} {...S} strokeWidth={2.8} />
        </>
      )}
      {kind === "fist" && (
        <>
          <rect x={-13} y={-12} width={26} height={22} rx={8} fill={W} {...S} strokeWidth={2.8} />
          <path d="M-6 -12 L-6 -2 M1 -12 L1 -2 M7 -12 L7 -2" stroke={INK} strokeWidth={2} />
        </>
      )}
    </g>
  );
}

function Arms({ pose, sleeve }: { pose: Pose; sleeve: { fill: string; tone?: boolean } }) {
  const Sleeve = ({ d }: { d: string }) => (
    <>
      <path d={d} fill={sleeve.fill} {...S} />
      {sleeve.tone && <path d={d} fill="url(#kensho-tone)" />}
    </>
  );
  switch (pose) {
    case "point":
      return (
        <g>
          <Sleeve d="M150 190 C162 168 172 140 178 118 L196 126 C190 152 178 186 166 214 Z" />
          <Hand x={188} y={112} r={20} kind="point" />
        </g>
      );
    case "explain":
      return (
        <g>
          <Sleeve d="M146 206 C156 192 164 176 168 160 L188 166 C184 186 176 206 164 226 Z" />
          <Hand x={178} y={152} r={14} kind="open" />
        </g>
      );
    case "think":
      return (
        <g>
          <Sleeve d="M56 240 C66 210 80 182 92 166 L112 176 C102 196 92 220 86 240 Z" />
          <Hand x={102} y={160} r={-10} kind="fist" />
        </g>
      );
    case "shock":
      return (
        <g>
          <Sleeve d="M40 214 C36 190 36 160 40 140 L60 144 C58 164 60 190 64 210 Z" />
          <Sleeve d="M160 214 C164 190 164 160 160 140 L140 144 C142 164 140 190 136 210 Z" />
          <Hand x={50} y={132} r={-12} kind="open" />
          <Hand x={150} y={132} r={12} kind="open" />
        </g>
      );
    case "cheer":
      return (
        <g>
          <Sleeve d="M150 196 C160 160 166 120 168 92 L190 94 C190 126 182 168 170 212 Z" />
          <Hand x={179} y={84} r={6} kind="fist" />
          <path d="M160 58 l-6 -14 M180 52 l0 -16 M198 60 l8 -12" {...S} strokeWidth={2.6} />
        </g>
      );
    default:
      return null;
  }
}

/* ───────────── Hoshi ───────────── */

function Hoshi({ exp, pose }: { exp: Expression; pose: Pose }) {
  return (
    <g>
      {/* low ponytail behind */}
      <path d="M128 112 C150 130 156 168 142 196 C136 176 128 150 116 132 Z" fill={INK} {...S} />
      {/* torso: lab coat over black turtleneck */}
      <path d="M26 240 C30 190 56 166 86 158 L114 158 C144 166 170 190 174 240 Z" fill={W} {...S} />
      <path d="M86 158 L100 214 L114 158 Z" fill={INK} />
      <path d="M86 158 L74 196 L92 190 L100 216 M114 158 L126 196 L108 190 L100 216" fill="none" {...S} strokeWidth={2.6} />
      <path d="M44 210 l0 30 M156 210 l0 30" {...S} strokeWidth={2} />
      <rect x={130} y={206} width={22} height={16} fill="none" {...S} strokeWidth={2} />
      <path d="M136 206 l0 -10" {...S} strokeWidth={2.4} />
      {/* neck */}
      <path d="M89 134 L89 160 L111 160 L111 134" fill={W} {...S} />
      <rect x={86} y={150} width={28} height={12} rx={3} fill={INK} />
      {/* head */}
      <path d="M60 84 C60 44 140 44 140 84 C140 114 124 138 100 142 C76 138 60 114 60 84 Z" fill={W} {...S} />
      <path d="M60 92 q-8 2 -4 12 q4 6 8 2 M140 92 q8 2 4 12 q-4 6 -8 2" fill={W} {...S} strokeWidth={2.6} />
      {/* hair: swept, sharp bangs */}
      <path
        d="M54 96 C44 46 78 22 108 26 C140 28 162 54 148 100 L142 80 C138 70 132 64 126 60 L128 84 L114 62 L108 86 L98 60 L86 88 L84 62 L70 86 L66 70 C62 78 58 86 54 96 Z"
        fill={INK}
        {...S}
      />
      <path d="M86 36 C100 30 118 32 128 40" stroke={W} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M94 44 C104 40 114 41 120 45" stroke={W} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Brows y={76} exp={exp} />
      <Eye cx={82} cy={94} exp={exp} big={false} />
      <Eye cx={118} cy={94} exp={exp} big={false} />
      {/* glasses */}
      <g fill="none" {...S} strokeWidth={2.4}>
        <rect x={67} y={83} width={30} height={22} rx={5} />
        <rect x={103} y={83} width={30} height={22} rx={5} />
        <path d="M97 92 L103 92 M67 90 L60 88 M133 90 L140 88" />
      </g>
      <path d="M72 101 L80 87 M108 101 L116 87" stroke={W} strokeWidth={2.6} strokeLinecap="round" opacity={exp === "serious" || exp === "smug" ? 1 : 0} />
      <path d="M100 100 L97 112 L101 113" fill="none" {...S} strokeWidth={2} />
      <Mouth exp={exp} y={122} />
      {(exp === "happy" || exp === "excited") && <Blush />}
      <Effects exp={exp} />
      <Arms pose={pose} sleeve={{ fill: W }} />
    </g>
  );
}

/* ───────────── Kai ───────────── */

function Kai({ exp, pose }: { exp: Expression; pose: Pose }) {
  return (
    <g>
      {/* hoodie */}
      <path d="M24 240 C28 192 54 166 86 158 L114 158 C146 166 172 192 176 240 Z" fill={W} {...S} />
      <path d="M24 240 C28 192 54 166 86 158 L114 158 C146 166 172 192 176 240 Z" fill="url(#kensho-tone)" />
      <path d="M70 168 C78 186 122 186 130 168" fill={W} {...S} />
      <path d="M90 182 l-4 34 M110 182 l4 34" {...S} strokeWidth={2.4} />
      <circle cx={86} cy={218} r={3} fill={INK} />
      <circle cx={114} cy={218} r={3} fill={INK} />
      {/* neck */}
      <path d="M90 134 L90 166 L110 166 L110 134" fill={W} {...S} />
      {/* head */}
      <path d="M58 86 C58 44 142 44 142 86 C142 116 124 140 100 144 C76 140 58 116 58 86 Z" fill={W} {...S} />
      <path d="M58 94 q-8 2 -4 12 q4 6 8 2 M142 94 q8 2 4 12 q-4 6 -8 2" fill={W} {...S} strokeWidth={2.6} />
      {/* spiky hair */}
      <path
        d="M52 98 L40 76 L56 74 L42 48 L66 54 L64 26 L86 42 L96 14 L110 38 L130 18 L132 46 L156 36 L148 62 L166 66 L150 82 L156 100 L142 84 L136 66 L126 82 L118 62 L108 84 L100 60 L90 82 L82 62 L74 84 L66 68 Z"
        fill={INK}
        {...S}
      />
      <path d="M84 40 L98 26 M104 34 L118 24" stroke={W} strokeWidth={3} strokeLinecap="round" />
      <Brows y={78} exp={exp} gap={19} />
      <Eye cx={81} cy={97} exp={exp} big />
      <Eye cx={119} cy={97} exp={exp} big />
      <path d="M100 104 L98 112" {...S} strokeWidth={2} />
      {/* cheek plaster */}
      <g transform="rotate(-18 128 116)">
        <rect x={120} y={112} width={16} height={7} rx={2} fill={W} {...S} strokeWidth={2} />
        <path d="M126 113 l0 5 M130 113 l0 5" stroke={INK} strokeWidth={1.2} />
      </g>
      <Mouth exp={exp} y={124} />
      {(exp === "happy" || exp === "excited") && <Blush />}
      <Effects exp={exp} />
      <Arms pose={pose} sleeve={{ fill: W, tone: true }} />
    </g>
  );
}

/* ───────────── Sumi (ink-fish scout) ───────────── */

function Sumi({ exp }: { exp: Expression }) {
  // Same geometry as the page-mascot sprite sheets (scripts/build-mascot.mjs), scaled into this
  // viewBox, so Sumi looks identical in panels, loaders and the opening.
  const bx = 180;
  const by = 196;
  const look: Record<Expression, [number, number]> = {
    neutral: [0, 0], happy: [0, 0], excited: [0, 0], surprised: [0, 0], thinking: [10, -12],
    confused: [-8, 6], serious: [0, 4], smug: [8, 0], worried: [-4, 12],
  };
  const [px, py] = look[exp];
  const eyes: [number, number][] = [[bx - 40, by - 4], [bx + 40, by - 4]];
  const open = ([x, y]: [number, number], big = false, small = false) => (
    <g key={x}>
      <ellipse cx={x} cy={y} rx={big ? 36 : 31} ry={big ? 42 : 37} fill={W} />
      <circle cx={x + px} cy={y + py} r={small ? 9 : 19} fill={INK} />
      {!small && <circle cx={x + px - 6} cy={y + py - 8} r={6.5} fill={W} />}
    </g>
  );
  const closed = ([x, y]: [number, number]) => <path key={x} d={`M${x - 24} ${y + 8} Q${x} ${y - 22} ${x + 24} ${y + 8}`} stroke={W} strokeWidth={9} fill="none" strokeLinecap="round" />;
  const flat = ([x, y]: [number, number]) => <path key={x} d={`M${x - 24} ${y + 2} L${x + 24} ${y - 2}`} stroke={W} strokeWidth={9} strokeLinecap="round" />;
  const eyeArt =
    exp === "happy" ? eyes.map(closed)
    : exp === "excited" ? eyes.map((e) => open(e, true))
    : exp === "surprised" ? eyes.map((e) => open(e, true, true))
    : exp === "serious" ? eyes.map(flat)
    : exp === "smug" ? [closed(eyes[0]), open(eyes[1])]
    : eyes.map((e) => open(e));
  const my = by + 58;
  const mouth =
    exp === "happy" || exp === "excited" ? <path d={`M${bx - 22} ${my - 4} Q${bx} ${my + 30} ${bx + 22} ${my - 4} Z`} fill={W} />
    : exp === "surprised" ? <ellipse cx={bx} cy={my + 4} rx={10} ry={13} fill={W} />
    : exp === "confused" || exp === "worried" ? <path d={`M${bx - 18} ${my + 4} q6 -8 12 0 t12 0 t12 0`} stroke={W} strokeWidth={5} fill="none" strokeLinecap="round" />
    : <path d={`M${bx - 14} ${my} Q${bx} ${my + 14} ${bx + 14} ${my}`} stroke={W} strokeWidth={6} fill="none" strokeLinecap="round" />;
  return (
    <g transform="translate(-8 26) scale(0.62)">
      <g className="bob">
        <path d={`M${bx + 92} ${by + 6} C${bx + 128} ${by - 40} ${bx + 150} ${by - 44} ${bx + 156} ${by - 26} C${bx + 140} ${by - 6} ${bx + 140} ${by + 18} ${bx + 156} ${by + 40} C${bx + 146} ${by + 56} ${bx + 122} ${by + 50} ${bx + 92} ${by + 18} Z`} fill={INK} />
        <path d={`M${bx - 30} ${by - 88} C${bx - 18} ${by - 132} ${bx + 26} ${by - 140} ${bx + 46} ${by - 112} C${bx + 26} ${by - 108} ${bx + 14} ${by - 98} ${bx + 10} ${by - 86} Z`} fill={INK} />
        <path d={`M${bx - 100} ${by + 22} C${bx - 132} ${by + 18} ${bx - 140} ${by + 44} ${bx - 128} ${by + 62} C${bx - 116} ${by + 50} ${bx - 104} ${by + 46} ${bx - 92} ${by + 46} Z`} fill={INK} />
        <path d={`M${bx - 108} ${by + 4} C${bx - 108} ${by - 64} ${bx - 56} ${by - 96} ${bx} ${by - 96} C${bx + 62} ${by - 96} ${bx + 108} ${by - 58} ${bx + 108} ${by + 6} C${bx + 108} ${by + 70} ${bx + 60} ${by + 104} ${bx} ${by + 104} C${bx - 62} ${by + 104} ${bx - 108} ${by + 68} ${bx - 108} ${by + 4} Z`} fill={INK} />
        <path d={`M${bx - 78} ${by - 30} C${bx - 70} ${by - 60} ${bx - 46} ${by - 76} ${bx - 18} ${by - 80}`} stroke={W} strokeWidth={7} fill="none" strokeLinecap="round" />
        {eyeArt}
        {mouth}
        {(exp === "happy" || exp === "excited") && (
          <g stroke={W} strokeWidth={4} strokeLinecap="round">
            {[0, 10, 20].map((d) => <path key={d} d={`M${bx - 86 + d} ${by + 38} l-5 10 M${bx + 66 + d} ${by + 38} l-5 10`} />)}
          </g>
        )}
        {exp === "excited" && <path d={`M${bx + 128} ${by - 120} l5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5 Z`} fill={INK} />}
        {(exp === "confused" || exp === "worried") && (
          <text x={bx + 112} y={by - 96} fontFamily="var(--font-display)" fontSize="48" fill={INK}>?</text>
        )}
      </g>
    </g>
  );
}

export function ToneDefs() {
  return (
    <defs>
      <pattern id="kensho-tone" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.25" fill="var(--ink)" />
      </pattern>
    </defs>
  );
}

export function Character({
  id,
  expression = "neutral",
  pose = "idle",
  flip = false,
  className,
  title,
}: {
  id: CharacterId;
  expression?: Expression;
  pose?: Pose;
  flip?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 210 240"
      preserveAspectRatio="xMidYMax meet"
      className={className}
      role="img"
      aria-label={title ?? `${CHARACTER_NAMES[id]}, ${expression}`}
      style={{ overflow: "visible" }}
    >
      <ToneDefs />
      <g transform={flip ? "translate(210 0) scale(-1 1)" : undefined}>
        {id === "hoshi" && <Hoshi exp={expression} pose={pose} />}
        {id === "kai" && <Kai exp={expression} pose={pose} />}
        {id === "sumi" && <Sumi exp={expression} />}
      </g>
    </svg>
  );
}
