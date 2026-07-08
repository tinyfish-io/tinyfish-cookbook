"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, PackageSearch, LineChart } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const items = [
  { href: "/", label: "Competitor Watch", icon: LayoutGrid },
  { href: "/restock", label: "Stock Report", icon: PackageSearch },
  { href: "/pricing", label: "Pricing Intelligence", icon: LineChart },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center shrink-0">
            <Logo size={16} />
          </div>
          <p className="font-serif text-[16px] tracking-tight text-shimmer whitespace-nowrap">MarketPulse</p>
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-surface-alt rounded-full p-1">
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all ${
                  active ? "bg-accent text-[#1a1108] font-medium" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>

      <nav className="md:hidden flex px-4 pb-2 gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${active ? "bg-accent text-[#1a1108] font-medium" : "text-text-secondary"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
