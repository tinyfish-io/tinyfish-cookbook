export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className ?? 'h-9 w-9'}
      style={{ width: '2.25rem', height: '2.25rem' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fs-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-gold)" />
        </linearGradient>
      </defs>
      <path fill="url(#fs-grad)" d="M20 3c2.6 4.4 2.6 9.2 0 14.6C17.4 12.2 17.4 7.4 20 3Z" />
      <path fill="url(#fs-grad)" opacity="0.85" d="M8 9c4.8 1.4 8.2 4.8 10.2 10.4C12.6 18.2 9.2 14.8 8 9Z" />
      <path fill="url(#fs-grad)" opacity="0.85" d="M32 9c-4.8 1.4-8.2 4.8-10.2 10.4C27.4 18.2 30.8 14.8 32 9Z" />
      <path fill="url(#fs-grad)" opacity="0.6" d="M4 30c6-2 11-2 16 0 5-2 10-2 16 0-5 4-11 6-16 6S9 34 4 30Z" />
    </svg>
  );
}
