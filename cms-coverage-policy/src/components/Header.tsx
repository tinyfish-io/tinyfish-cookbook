import Link from "next/link";

const NAV = [
  { href: "/", label: "Coverage map", key: "map" },
  { href: "/changes", label: "What changed", key: "changes" },
  { href: "/compare", label: "Compare states", key: "compare" },
] as const;

export function Header({ active, sweptLine }: { active: (typeof NAV)[number]["key"]; sweptLine: string }) {
  return (
    <header className="flex items-center gap-10 border-b px-16 py-5 max-lg:px-6" style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}>
      <Link href="/" className="flex items-center gap-3 !no-underline" style={{ color: "var(--color-ink)" }}>
        <div className="grid size-9 place-items-center rounded-[11px]" style={{ background: "var(--color-primary)" }}>
          {/* crescent-dot mark from the handoff */}
          <div
            className="size-3.5 rounded-full"
            style={{ background: "var(--color-card)", boxShadow: "8px -6px 0 -4px var(--color-card), -8px 7px 0 -5px var(--color-card)" }}
          />
        </div>
        <span className="text-[19px] font-extrabold tracking-tight">Coverage Atlas</span>
      </Link>
      <nav className="flex gap-1.5">
        {NAV.map((item) => (
          <Link key={item.key} href={item.href} className="!no-underline">
            <span className={item.key === active ? "nav-pill nav-pill--active" : "nav-pill"} style={{ display: "inline-block" }}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3.5">
        <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm" style={{ background: "var(--color-chipbg)", color: "var(--color-secondary)" }}>
          <span className="fresh-dot" aria-hidden />
          {sweptLine}
        </div>
      </div>
    </header>
  );
}
