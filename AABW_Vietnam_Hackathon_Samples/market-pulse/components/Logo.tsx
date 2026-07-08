export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mp-gold" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8F6A14" />
          <stop offset="1" stopColor="#F0D98A" />
        </linearGradient>
      </defs>
      <path
        d="M16 3 L27 12 L23 27 L9 27 L5 12 Z"
        fill="url(#mp-gold)"
        fillOpacity="0.16"
        stroke="url(#mp-gold)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8 18 L12.5 18 L14.5 13 L17 22 L19 16.5 L20.5 18 L24 18"
        stroke="url(#mp-gold)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
