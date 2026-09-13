export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fg-jet" x1="4" y1="26" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E3A8A" />
          <stop offset="1" stopColor="#7DD3FC" />
        </linearGradient>
      </defs>
      {/* Orbit ring / swoosh — passes behind the plane, loops back over itself */}
      <path
        d="M4.5 19c1 5.5 9 8 15 5.3 4-1.8 6-4.6 5.3-6.7"
        stroke="url(#fg-jet)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6.5 23.3c4.3 2.6 12.5 2.2 16.6-3.1 1.6-2 2-4 1.2-5.4"
        stroke="url(#fg-jet)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      {/* Jet, breaking out of the loop toward the upper right */}
      <path
        d="M11 19.5c3.6-3.4 7.9-6.4 11.6-8L27 6.3c1.1-1 2.4-.5 2 1l-2.1 7.7c-.6 2.5-3.1 5.7-6.2 7.9-2.7 2-8.7 4.6-11 4.2-.6-.1-.4-1 .3-1.7Z"
        fill="url(#fg-jet)"
      />
      <path d="M17.8 15.2 13.6 14l2-2 3.3.7-1.1 2.5Z" fill="url(#fg-jet)" />
      <path d="M21.6 20.2 22.9 24.4l-2-1.9-.9-3.3 1.6.9Z" fill="url(#fg-jet)" />
    </svg>
  );
}
