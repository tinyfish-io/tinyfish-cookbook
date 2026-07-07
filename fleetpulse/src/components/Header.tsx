"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const items = [
  { href: "/", label: "Fleet Overview" },
  { href: "/service", label: "Service Requests" },
];

export default function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center">
            <Logo size={16} />
          </div>
          <div>
            <p className="font-serif text-[16px] leading-none text-shimmer">FleetPulse</p>
            <p className="text-[10px] text-text-muted mt-0.5">Fleet cost intelligence</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 bg-surface-alt rounded-full p-1">
          {items.map((item) => {
            const active = pathname === item.href || (item.href === "/service" && pathname.startsWith("/service"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${active ? "bg-accent text-white font-medium" : "text-text-secondary hover:text-text-primary"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
