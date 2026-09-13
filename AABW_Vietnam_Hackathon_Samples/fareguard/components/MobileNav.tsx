"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const tabs = [
  { href: "/", label: "Dashboard" },
  { href: "/booking", label: "Booking" },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <header className="md:hidden border-b border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent-soft flex items-center justify-center text-accent">
            <Logo size={16} />
          </div>
          <p className="font-medium text-[15px]">FareGuard</p>
        </div>
        <ThemeToggle />
      </div>
      <nav className="flex px-4 pb-2 gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-md text-sm ${
                active ? "bg-accent-soft text-text-primary font-medium" : "text-text-secondary"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
