import Link from "next/link";
import { Brand } from "./Brand";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#extract", label: "What it reads" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition-colors hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/jobs" className="px-3 py-2 text-muted transition-colors hover:text-foreground">
            My radar
          </Link>
          <Link href="/onboarding" className="bg-accent px-4 py-2 font-medium text-accent-ink transition-opacity hover:opacity-90">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
