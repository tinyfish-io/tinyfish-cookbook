export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fp-amber" x1="4" y1="26" x2="28" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B8631A" />
          <stop offset="1" stopColor="#F4C27E" />
        </linearGradient>
      </defs>
      <path d="M6 20 L9 12 H23 L26 20 Z" fill="url(#fp-amber)" fillOpacity="0.16" stroke="url(#fp-amber)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 22 H28" stroke="url(#fp-amber)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="22" r="2" fill="url(#fp-amber)" />
      <circle cx="22" cy="22" r="2" fill="url(#fp-amber)" />
    </svg>
  );
}
