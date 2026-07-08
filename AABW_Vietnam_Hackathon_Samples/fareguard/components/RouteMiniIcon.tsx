export default function RouteMiniIcon() {
  const pathD = "M13 22 C 60 -2, 100 44, 150 8";

  return (
    <svg width="100%" height="32" viewBox="0 0 160 32" fill="none" preserveAspectRatio="xMinYMid meet">
      <circle cx="10" cy="24" r="3" fill="var(--accent)" />
      <path
        d={pathD}
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeDasharray="1 5"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <circle cx="150" cy="8" r="3" fill="var(--accent)" />

      {/* Plane flies the route continuously, banking to follow the curve */}
      <g>
        <path d="M0 -2.5 L6 0 L0 2.5 L1.3 0 Z" fill="var(--accent)">
          <animateMotion dur="3.2s" repeatCount="indefinite" rotate="auto" path={pathD} />
        </path>
      </g>
    </svg>
  );
}
