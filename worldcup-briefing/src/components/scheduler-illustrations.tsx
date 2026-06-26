/* Hand-drawn, PhD-Comics-style illustrations that explain the "set it once,
   the agent delivers reels to your channel on a schedule" concept.

   Everything is inline SVG drawn with currentColor ink so a single panel works
   on either a light ("paper") or dark surface — set the ink via a text color
   class on the wrapper. Accents use the brand orange (#F24E1E). The deliberate
   wobble in the strokes is what gives it the hand-sketched feel. */

import React from "react";

const INK = "currentColor";
const ORANGE = "#F24E1E";

/* A wobbly hand-drawn panel frame. */
function SketchFrame({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <svg viewBox="0 0 220 200" className="h-auto w-full" role="img" aria-label={label} fill="none">
      <path
        d="M10 14 Q12 9 18 8 L196 6 Q205 7 206 14 L208 184 Q207 192 199 193 L20 195 Q11 194 10 186 Z"
        stroke={INK}
        strokeWidth="2.4"
        className="sketch-stroke"
        opacity="0.9"
      />
      {children}
    </svg>
  );
}



/* ── STEPPER PANELS (Phase 5 – videodb-deck style) ────────────────────── */
/*
   Visual language: stick-figure cartoons, speech bubbles, wobbly hand-drawn
   strokes, #F24E1E orange for focal points. One clear narrative per panel.
   Toolkit references (from videodb-deck): stick, bubble, gear, arrow, box, frame.
*/

/* Panel 1 — Plug in your keys to wake the agent */
export function PanelConnectKeys() {
  return (
    <SketchFrame label="Connect your TinyFish and VideoDB API keys">
      <rect x="38" y="70" width="72" height="70" rx="14" stroke={INK} strokeWidth="2.5" className="sketch-stroke" />
      <path d="M74 54 L74 70" stroke={INK} strokeWidth="2.4" className="sketch-stroke" />
      <circle cx="74" cy="49" r="5" fill={ORANGE} />
      <circle cx="62" cy="96" r="5" stroke={ORANGE} strokeWidth="2.1" className="sketch-stroke" />
      <circle cx="87" cy="96" r="5" stroke={ORANGE} strokeWidth="2.1" className="sketch-stroke" />
      <path d="M62 118 Q74 126 88 118" stroke={INK} strokeWidth="2.1" className="sketch-stroke" />

      <rect x="126" y="86" width="48" height="34" rx="8" stroke={INK} strokeWidth="2.4" className="sketch-stroke" />
      <path d="M126 98 L111 98 M111 90 L111 106 M174 98 L189 98 M189 90 L189 106" stroke={INK} strokeWidth="2.4" className="sketch-stroke" />
      <circle cx="151" cy="55" r="10" stroke={ORANGE} strokeWidth="2.4" className="sketch-stroke" />
      <path d="M142 61 L120 78 M128 72 L136 80 M120 78 L126 84" stroke={ORANGE} strokeWidth="2.4" className="sketch-stroke" />
      <path d="M117 80 Q126 75 136 71" stroke={INK} strokeWidth="1.8" strokeDasharray="2 5" className="sketch-stroke" />
      <path d="M119 139 Q144 154 177 138" stroke={ORANGE} strokeWidth="2.2" className="sketch-stroke" />
      <path d="M174 131 L184 137 L174 144" stroke={ORANGE} strokeWidth="2.2" className="sketch-stroke" />
      <text x="111" y="169" textAnchor="middle" className="font-hand" fontSize="18" fill={INK}>keys connected</text>
    </SketchFrame>
  );
}

/* Panel 2 — Connect a Telegram, Discord, or Slack inbox */
export function PanelAddInbox() {
  return (
    <SketchFrame label="Add your Telegram, Discord, or Slack inbox">
      <rect x="52" y="42" width="82" height="58" rx="14" stroke={INK} strokeWidth="2.5" className="sketch-stroke" />
      <path d="M74 100 L62 118 L88 102" stroke={INK} strokeWidth="2.4" className="sketch-stroke" />
      <path d="M69 62 L117 62 M69 79 L103 79" stroke={INK} strokeWidth="2" opacity="0.55" className="sketch-stroke" />
      <circle cx="134" cy="41" r="11" fill={ORANGE} />
      <text x="134" y="47" textAnchor="middle" className="font-hand" fontSize="17" fill={INK}>1</text>

      <path d="M93 126 Q122 109 154 96" stroke={ORANGE} strokeWidth="2.2" strokeDasharray="3 6" className="sketch-stroke" />
      <path d="M134 87 L169 78 L147 112 L143 96 Z" stroke={ORANGE} strokeWidth="2.4" className="sketch-stroke" />

      <rect x="145" y="96" width="42" height="66" rx="9" stroke={INK} strokeWidth="2.5" className="sketch-stroke" />
      <path d="M153 111 L177 111 M153 126 L171 126 M153 141 L176 141" stroke={INK} strokeWidth="1.7" opacity="0.6" className="sketch-stroke" />
      <path d="M189 109 q8 6 7 15 M141 109 q-8 6 -7 15" stroke={ORANGE} strokeWidth="2" className="sketch-stroke" />
      <text x="94" y="162" textAnchor="middle" className="font-hand" fontSize="18" fill={INK}>reels land here</text>
    </SketchFrame>
  );
}

/* Panel 3 — Agent runs on schedule, reel arrives while you sleep */
export function PanelSetSchedule() {
  return (
    <SketchFrame label="Set it once — delivered every day">
      <rect x="42" y="44" width="136" height="116" rx="14" stroke={INK} strokeWidth="2.5" className="sketch-stroke" />
      <path d="M42 68 Q82 71 178 67" stroke={INK} strokeWidth="2" className="sketch-stroke" />
      <path d="M66 36 L66 55 M154 36 L154 55" stroke={INK} strokeWidth="2.4" className="sketch-stroke" />
      <circle cx="110" cy="103" r="34" stroke={INK} strokeWidth="2.5" className="sketch-stroke" />
      <circle cx="110" cy="103" r="34" stroke={ORANGE} strokeWidth="2.1" strokeDasharray="3 8" opacity="0.75" className="sketch-stroke" />
      <path d="M110 103 L110 80" stroke={INK} strokeWidth="2.5" className="sketch-stroke" />
      <path d="M110 103 L128 112" stroke={ORANGE} strokeWidth="2.5" className="sketch-stroke" />
      <circle cx="110" cy="103" r="3" fill={INK} />
      <path d="M67 86 L82 86 M67 104 L82 104 M67 122 L82 122" stroke={INK} strokeWidth="1.7" opacity="0.55" className="sketch-stroke" />
      <path d="M140 86 L154 86 M140 104 L154 104 M140 122 L154 122" stroke={INK} strokeWidth="1.7" opacity="0.55" className="sketch-stroke" />
      <text x="110" y="151" textAnchor="middle" className="font-hand" fontSize="18" fill={ORANGE}>daily at 9:00</text>
    </SketchFrame>
  );
}

/* ── Panel 4 — Delivered to you ───────────────────────────────────────── */
export function PanelDelivered() {
  return (
    <SketchFrame label="The reel is delivered to you">
      <rect x="36" y="80" width="50" height="42" rx="8" stroke={INK} strokeWidth="2.4" className="sketch-stroke" />
      <path d="M61 67 L61 80" stroke={INK} strokeWidth="2.2" className="sketch-stroke" />
      <circle cx="61" cy="63" r="4" fill={ORANGE} />
      <circle cx="51" cy="99" r="4" stroke={ORANGE} strokeWidth="2" className="sketch-stroke" />
      <circle cx="71" cy="99" r="4" stroke={ORANGE} strokeWidth="2" className="sketch-stroke" />
      <path d="M50 111 Q61 116 72 111" stroke={INK} strokeWidth="2" className="sketch-stroke" />

      <g stroke={INK} strokeWidth="2" className="sketch-stroke">
        <rect x="44" y="135" width="62" height="22" rx="5" />
        <path d="M52 135 L52 157 M64 135 L64 157 M76 135 L76 157 M88 135 L88 157 M100 135 L100 157" opacity="0.55" />
      </g>
      <path d="M102 122 L112 134 M112 122 L102 134" stroke={ORANGE} strokeWidth="2.1" className="sketch-stroke" />

      <path d="M92 88 Q112 73 134 72" stroke={ORANGE} strokeWidth="2.2" className="sketch-stroke" />
      <path d="M130 63 L143 72 L130 80" stroke={ORANGE} strokeWidth="2.2" className="sketch-stroke" />

      <g className="deliver-buzz" style={{ transformBox: "fill-box" } as React.CSSProperties}>
        <rect x="132" y="46" width="52" height="92" rx="11" stroke={INK} strokeWidth="2.5" className="sketch-stroke" />
        <path d="M140 58 L176 58 M140 126 L176 126" stroke={INK} strokeWidth="1.6" opacity="0.7" className="sketch-stroke" />
        <rect x="142" y="72" width="32" height="28" rx="5" stroke={ORANGE} strokeWidth="2.1" className="sketch-stroke" />
        <path d="M154 79 L166 86 L154 93 Z" fill={ORANGE} />
        <path d="M143 110 Q157 114 175 109" stroke={INK} strokeWidth="1.8" opacity="0.6" className="sketch-stroke" />
      </g>
      <path d="M190 62 q8 8 6 18 M190 116 q8 -8 6 -18 M126 62 q-8 8 -6 18 M126 116 q-8 -8 -6 -18" stroke={ORANGE} strokeWidth="2" className="sketch-stroke" />
      <text x="111" y="174" textAnchor="middle" className="font-hand" fontSize="17" fill={INK}>clip lands</text>
    </SketchFrame>
  );
}

/* ── A circular "set once → runs every day → delivered" loop badge ─────── */
export function DeliveryLoopIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 260" className={className} role="img" aria-label="Set it once, delivered every day" fill="none">
      {/* circular loop: set once -> every day -> delivered */}
      <path d="M130 34 Q194 36 222 91 Q248 146 207 197 Q164 245 97 225 Q35 207 28 137 Q21 72 75 45 Q98 34 130 34" stroke={INK} strokeWidth="2.3" strokeDasharray="3 9" opacity="0.55" className="sketch-stroke" />
      <path d="M216 82 L230 91 L216 101" stroke={ORANGE} strokeWidth="2.8" className="sketch-stroke" />
      <path d="M44 181 L30 171 L47 164" stroke={ORANGE} strokeWidth="2.8" className="sketch-stroke" />

      <g className="float-bob">
        <rect x="91" y="79" width="78" height="72" rx="11" stroke={INK} strokeWidth="2.6" className="sketch-stroke" />
        <path d="M91 101 Q119 104 169 101" stroke={INK} strokeWidth="2.2" className="sketch-stroke" />
        <path d="M108 69 L108 88 M152 69 L152 88" stroke={INK} strokeWidth="2.6" className="sketch-stroke" />
        <circle cx="113" cy="121" r="4.5" fill={ORANGE} />
        <circle cx="130" cy="121" r="3.8" fill={INK} opacity="0.35" />
        <circle cx="147" cy="121" r="3.8" fill={INK} opacity="0.35" />
        <circle cx="113" cy="137" r="3.8" fill={INK} opacity="0.35" />
        <circle cx="130" cy="137" r="3.8" fill={INK} opacity="0.35" />
      </g>

      <g stroke={INK} strokeWidth="2.3" className="sketch-stroke">
        <circle cx="66" cy="67" r="14" />
        <path d="M54 76 L34 91" />
        <path d="M43 84 L51 93" />
        <path d="M34 91 L40 99" />
      </g>

      <g className="deliver-buzz" style={{ transformBox: "fill-box" } as React.CSSProperties}>
        <rect x="183" y="165" width="42" height="58" rx="9" stroke={INK} strokeWidth="2.4" className="sketch-stroke" />
        <path d="M194 184 L215 196 L194 208 Z" stroke={ORANGE} strokeWidth="2" className="sketch-stroke" />
      </g>
      <path d="M230 178 q8 8 5 18 M178 178 q-8 8 -5 18" stroke={ORANGE} strokeWidth="2.2" className="sketch-stroke" />

      <text x="130" y="181" textAnchor="middle" className="font-hand" fontSize="22" fill={INK}>every day</text>
      <text x="130" y="204" textAnchor="middle" className="font-hand" fontSize="19" fill={ORANGE}>set once → delivered</text>
    </svg>
  );
}
