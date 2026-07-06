import { TICKER_SOURCES } from "./data";

export function ProblemTicker() {
  const items = [...TICKER_SOURCES, ...TICKER_SOURCES];

  return (
    <section className="border-y border-border bg-muted py-4">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-3 text-center font-[family-name:var(--font-display)] text-sm italic text-muted-foreground">
          By the time you notice, competitors already launched.
        </p>
        <div className="overflow-hidden">
          <div className="ticker-track gap-8">
            {items.map((source, i) => (
              <span
                key={`${source}-${i}`}
                className="flex shrink-0 items-center gap-2 font-[family-name:var(--font-punch)] text-lg tracking-widest text-nuoc"
              >
                <span className="vn-star" />
                {source}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
