import Link from "next/link";

export function TopBar({ active, ticker = "CBRL", now }: { active: "scan" | "company" | "lead"; ticker?: string; now?: string }) {
  const TABS = [
    { href: "/", label: "Live scan", key: "scan" },
    { href: `/company/${ticker}`, label: "Company read", key: "company" },
    { href: `/company/${ticker}/lead-time`, label: "Lead time", key: "lead" },
  ] as const;
  const stamp =
    now ??
    new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  return (
    <div className="flex items-center gap-5 px-12 py-[18px] rule-ink">
      <div className="font-serif text-2xl font-semibold tracking-tight">Upstream</div>
      <div className="eyebrow pt-[3px] text-muted" style={{ fontSize: 10, letterSpacing: "0.18em" }}>
        Primary-source research
      </div>
      <nav className="ml-auto flex gap-7">
        {TABS.map((tab) => (
          <Link key={tab.key} href={tab.href} className={tab.key === active ? "nav-link nav-link--active" : "nav-link"}>
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="ml-5 flex items-center gap-2 text-xs text-muted tnum">
        <span className="pulse-dot" aria-hidden />
        LIVE · {stamp} ET
      </div>
    </div>
  );
}
