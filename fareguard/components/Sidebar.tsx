"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarClock, Route, FileDown } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/booking", label: "Booking requests", icon: CalendarClock },
  { href: "/#monitored-routes", label: "Routes", icon: Route },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 border-r border-border bg-surface relative overflow-hidden">
      {/* Decorative flight-path background, purely ornamental */}
      <svg
        className="absolute -top-4 -right-16 opacity-[0.06] text-accent pointer-events-none"
        width="240"
        height="240"
        viewBox="0 0 240 240"
        fill="none"
      >
        <circle cx="120" cy="120" r="40" stroke="currentColor" strokeWidth="1" />
        <circle cx="120" cy="120" r="80" stroke="currentColor" strokeWidth="1" />
        <circle cx="120" cy="120" r="119" stroke="currentColor" strokeWidth="1" />
        <path d="M20 180 Q100 60 220 90" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 5" />
      </svg>

      <div className="relative px-5 pt-6 pb-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center text-accent shrink-0">
            <Logo size={19} />
          </div>
          <div>
            <p className="font-medium text-[15px] leading-none tracking-tight">FareGuard</p>
            <p className="text-[11px] text-text-muted mt-1">Corporate travel cost control</p>
          </div>
        </div>
      </div>

      <nav className="relative flex-1 px-3 py-4 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href.split("#")[0] && !item.href.includes("#");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-accent-soft text-text-primary font-medium"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-alt"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} className={active ? "text-accent" : ""} />
              {item.label}
            </Link>
          );
        })}
        <a
          href="/api/report"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
        >
          <FileDown size={16} strokeWidth={1.75} />
          Reports
        </a>
      </nav>

      <div className="relative px-5 py-4 border-t border-border flex items-center justify-between">
        <p className="text-[11px] text-text-muted">Vietnam domestic routes</p>
        <ThemeToggle />
      </div>
    </aside>
  );
}
