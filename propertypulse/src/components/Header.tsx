import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center">
            <Logo size={16} />
          </div>
          <div>
            <p className="font-serif text-[16px] leading-none text-shimmer">PropertyPulse</p>
            <p className="text-[10px] text-text-muted mt-0.5">Real estate market intelligence</p>
          </div>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
