const COLORS = [
  "from-[#1b2838] via-[#1e3048] to-[#162230]",
  "from-[#4a1e2a] via-[#5a2633] to-[#3d1822]",
  "from-[#1e3a2a] via-[#264d35] to-[#182e21]",
  "from-[#2d1a3a] via-[#3a224a] to-[#24142e]",
  "from-[#1a2e33] via-[#223d45] to-[#14252a]",
  "from-[#3a2a1e] via-[#4d3828] to-[#2e1e14]",
];

const PATTERNS: Record<string, () => React.ReactElement[]> = {
  "stripes-h": () =>
    Array.from({ length: 8 }).map((_, i) => (
      <line key={i} x1="0" y1={i * 32 + 8} x2="400" y2={i * 32 + 8} stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
    )),
  circles: () => {
    const els: React.ReactElement[] = [];
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 6; col++)
        els.push(<circle key={`${row}-${col}`} cx={40 + col * 72} cy={20 + row * 56} r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />);
    return els;
  },
  "stripes-v": () =>
    Array.from({ length: 10 }).map((_, i) => (
      <line key={i} x1={i * 44 + 10} y1="0" x2={i * 44 + 10} y2="225" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
    )),
  dots: () => {
    const els: React.ReactElement[] = [];
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 8; col++)
        els.push(<circle key={`${row}-${col}`} cx={30 + col * 50} cy={20 + row * 52} r="6" fill="rgba(255,255,255,0.08)" />);
    return els;
  },
  crosshatch: () =>
    Array.from({ length: 10 }).map((_, i) => (
      <line key={i} x1={i * 48} y1="0" x2={i * 48 + 225} y2="225" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
    )),
};

function hashLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash << 5) - hash + label.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function FallbackThumbnail({ label }: { label: string }) {
  const h = hashLabel(label);
  const bg = COLORS[h % COLORS.length];
  const patternNames = ["stripes-h", "circles", "stripes-v", "dots", "crosshatch"];
  const pattern = patternNames[(h >> 3) % patternNames.length];

  return (
    <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-b ${bg}`}>
      <svg viewBox="0 0 400 225" className="absolute inset-0 size-full">
        {PATTERNS[pattern]()}
      </svg>
      <span className="relative z-10 text-center text-[13px] font-semibold text-[var(--c-text-subtle)] max-w-[80%] truncate px-3">
        {label}
      </span>
    </div>
  );
}
