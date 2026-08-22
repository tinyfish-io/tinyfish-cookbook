"use client";

import { useState, Fragment } from "react";

type Side = { plain: string; verbatim: string | null; source: string | null };
type Row = { criterion: string; label: string; differs: boolean; left: Side; right: Side };

export function CompareRows({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <>
      {rows.map((row) => {
        const isOpen = !!open[row.criterion];
        const cellStyle = row.differs
          ? { background: "oklch(0.97 0.03 95)", border: "1px solid oklch(0.88 0.06 95)" }
          : { background: "var(--color-card)", border: "1px solid var(--color-border)" };
        return (
          <Fragment key={row.criterion}>
            <div className="pl-1 pt-5 text-[15px] font-bold leading-snug max-md:pt-2" style={{ color: "var(--color-body)" }}>
              {row.label}
              {row.differs && (
                <div
                  className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold tracking-wide"
                  style={{ background: "oklch(0.93 0.06 85)", color: "oklch(0.45 0.1 70)" }}
                >
                  DIFFERS
                </div>
              )}
            </div>
            <div className="rounded-2xl px-5 py-4 text-[15.5px] leading-normal" style={{ ...cellStyle, color: "var(--color-heading)" }}>
              {row.left.plain}
            </div>
            <div className="rounded-2xl px-5 py-4 text-[15.5px] leading-normal" style={{ ...cellStyle, color: "var(--color-heading)" }}>
              {row.right.plain}
            </div>
            {(row.left.verbatim || row.right.verbatim) && (
              <>
                <div className="max-md:hidden" />
                <div className="col-span-2 max-md:col-span-1">
                  <button
                    className="cursor-pointer border-none bg-transparent px-1 py-0.5 text-[13.5px] font-semibold"
                    style={{ color: "var(--color-primary)" }}
                    onClick={() => setOpen((o) => ({ ...o, [row.criterion]: !o[row.criterion] }))}
                  >
                    {isOpen ? "Hide exact policy wording ▴" : "See exact policy wording ▾"}
                  </button>
                  {isOpen && (
                    <div className="mt-2 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
                      {[row.left, row.right].map((side, i) => (
                        <blockquote key={i} className="quote-panel" style={{ borderRadius: 14, padding: "14px 18px" }}>
                          <p className="quote-text" style={{ fontSize: 14.5 }}>
                            {side.verbatim ? `“${side.verbatim}”` : "No verbatim wording captured yet — the next sweep will pull it."}
                          </p>
                          {side.source && (
                            <div className="mt-1.5 text-xs" style={{ color: "var(--color-faint)" }}>
                              — {side.source}
                            </div>
                          )}
                        </blockquote>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
