import { Link } from "@tanstack/react-router";

type SiteHeaderProps = {
  variant?: "landing" | "app";
};

export function SiteHeader({ variant = "landing" }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-cream/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-[family-name:var(--font-punch)] text-2xl tracking-wide text-nuoc">
          Món<span className="text-chili">A</span>
          <span className="text-cilantro">I</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-nuoc md:flex">
          {variant === "landing" ? (
            <>
              <a href="#features" className="transition-colors hover:text-chili">
                Features
              </a>
              <a href="#trends" className="transition-colors hover:text-chili">
                Live Trends
              </a>
              <a href="#workflow" className="transition-colors hover:text-chili">
                Workflow
              </a>
            </>
          ) : (
            <Link to="/" className="transition-colors hover:text-chili">
              Home
            </Link>
          )}
          <Link to="/dashboard" className="transition-colors hover:text-chili">
            Dashboard
          </Link>
        </nav>
        <Link to="/dashboard" className="btn-primary text-sm">
          Bắt đầu ngay
        </Link>
      </div>
    </header>
  );
}
