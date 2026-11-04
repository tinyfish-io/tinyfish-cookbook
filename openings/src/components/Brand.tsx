import Link from "next/link";

/** Logo: a small radar dial + wide wordmark. */
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 text-accent" aria-label="Openings home">
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="4" fill="currentColor" />
        <circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.25" />
        <path d="M16 16 L16 6.5 A9.5 9.5 0 0 1 25 13 Z" fill="var(--data-violet)" />
        <circle cx="20.5" cy="10.5" r="1.6" fill="#fff" />
      </svg>
      <span className="font-display text-[1.05rem] leading-none tracking-tight text-foreground">Openings</span>
    </Link>
  );
}
