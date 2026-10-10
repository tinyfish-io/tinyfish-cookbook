export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pp-terra" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A34D22" />
          <stop offset="1" stopColor="#F0B37E" />
        </linearGradient>
      </defs>
      <path d="M16 4 L28 14.5 V27 H4 V14.5 Z" fill="url(#pp-terra)" fillOpacity="0.15" stroke="url(#pp-terra)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 27 V18 H20 V27" stroke="url(#pp-terra)" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="12.5" r="2.2" fill="url(#pp-terra)" />
    </svg>
  );
}
