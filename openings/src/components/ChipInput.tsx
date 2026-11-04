"use client";

import { useId, useState } from "react";

interface ChipInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  placeholder: string;
  suggestions?: string[];
  normalize?: (v: string) => string;
}

/** Type and press Enter (or comma) to add; click a suggestion to add it; × to remove. */
export function ChipInput({ label, values, onChange, max, placeholder, suggestions = [], normalize = (v) => v.trim() }: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const full = values.length >= max;

  const add = (raw: string) => {
    const v = normalize(raw);
    if (!v || full || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setDraft("");
  };

  const remaining = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === normalize(s).toLowerCase()));

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-[7px] border border-border bg-surface px-3 py-2 focus-within:border-highlight focus-within:ring-2 focus-within:ring-highlight/20">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-[4px] bg-accent/8 py-1 pl-2.5 pr-1 text-sm font-medium text-accent ring-1 ring-accent/25">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="grid size-5 place-items-center rounded hover:bg-accent/15"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={full}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v.slice(0, -1));
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={full ? `Max ${max}` : values.length ? "Add another…" : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-muted disabled:cursor-not-allowed"
        />
      </div>
      {remaining.length > 0 && !full && (
        <div className="mt-3 flex flex-wrap gap-2">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-[4px] border border-dashed border-border px-2.5 py-1 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
