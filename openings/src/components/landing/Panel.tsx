/** A product window: hairline border, soft float shadow, optional tab strip (DESIGN.md "Product panels"). */
export function Panel({
  title,
  tabs,
  active,
  right,
  className = "",
  children,
}: {
  title?: string;
  tabs?: string[];
  active?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`panel-shadow overflow-hidden rounded-[10px] border border-border bg-surface ${className}`}>
      {(title || tabs) && (
        <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs">
          <span className="flex gap-1" aria-hidden>
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
            <span className="size-2 rounded-full bg-border" />
          </span>
          {title && <span className="truncate font-medium text-foreground">{title}</span>}
          {tabs && (
            <span className="ml-1 hidden gap-1 sm:flex">
              {tabs.map((t) => (
                <span
                  key={t}
                  className={`rounded px-2 py-0.5 ${t === active ? "bg-sunken font-medium text-foreground" : "text-muted"}`}
                >
                  {t}
                </span>
              ))}
            </span>
          )}
          {right && <span className="ml-auto shrink-0">{right}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
