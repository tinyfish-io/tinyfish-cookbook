export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-nuoc px-6 py-8 text-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <p className="font-[family-name:var(--font-punch)] text-xl tracking-wide">
          Món<span className="text-chili">A</span>
          <span className="text-cilantro">I</span>
        </p>
        <p className="text-sm text-cream/70">
          © {new Date().getFullYear()} MónAI — Vietnam Food Trend Intelligence
        </p>
      </div>
    </footer>
  );
}
