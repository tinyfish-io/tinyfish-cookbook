"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { ChipInput } from "@/components/ChipInput";
import { DEFAULT_PREFS, savePrefs, useSavedPrefs, type StoredPrefs } from "@/lib/prefs";

const ROLE_PICKS = ["Software engineer", "Data scientist", "Machine learning engineer", "Product designer", "Product manager", "Data analyst"];
const LOCATION_PICKS = ["Remote", "New York", "San Francisco", "Toronto", "Seattle", "London"];
const KEYWORD_PICKS = ["python", "typescript", "react", "machine learning", "distributed systems"];
const COMPANY_PICKS = ["figma", "notion", "stripe", "palantir", "roblox", "databricks", "ramp", "openai"];
const THIS_YEAR = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 5 }, (_, i) => THIS_YEAR + i);

const STEPS = ["Role", "Where", "You", "Watchlist"] as const;

function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-[4px] border px-4 py-2.5 text-sm transition-all ${
              on ? "border-accent bg-accent/8 text-accent ring-1 ring-accent" : "border-border bg-surface text-foreground hover:border-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, title, body }: { checked: boolean; onChange: (v: boolean) => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-4 rounded-[4px] border p-4 text-left transition-colors ${checked ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-foreground/40"}`}
    >
      <span className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? "bg-accent" : "bg-border"}`}>
        <span className={`size-5 rounded-full bg-surface shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm text-muted">{body}</span>
      </span>
    </button>
  );
}

export default function Onboarding() {
  const saved = useSavedPrefs();
  // Wait until storage has been read so a returning user starts from their saved preferences.
  if (saved === undefined) return <div className="flex-1" />;
  return <OnboardingForm initial={saved ?? DEFAULT_PREFS} editing={saved !== null} />;
}

function OnboardingForm({ initial, editing }: { initial: StoredPrefs; editing: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<StoredPrefs>(initial);

  const set = <K extends keyof StoredPrefs>(k: K, v: StoredPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const canNext = step !== 0 || prefs.role.trim().length >= 2;
  const last = step === STEPS.length - 1;

  const finish = () => {
    savePrefs({ ...prefs, role: prefs.role.trim().toLowerCase() });
    router.push("/jobs?run=1");
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        {editing && (
          <Link href="/jobs" className="text-sm text-muted hover:text-foreground">
            Cancel
          </Link>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-10 sm:px-6">
        {/* Progress rail */}
        <ol className="grid grid-cols-4 gap-2" aria-label="Setup steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={i > step && !canNext}
                onClick={() => (i <= step || canNext) && setStep(i)}
                className="w-full text-left"
                aria-current={i === step ? "step" : undefined}
              >
                <span className={`block h-1 rounded-full transition-colors ${i <= step ? "bg-accent" : "bg-border"}`} />
                <span className={`mt-2 block font-mono text-[11px] uppercase tracking-wider ${i === step ? "text-foreground" : "text-muted"}`}>
                  {String(i + 1).padStart(2, "0")} {s}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <form
          className="mt-10 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canNext) return;
            if (last) finish();
            else setStep(step + 1);
          }}
        >
          <div key={step} className="reveal flex-1">
            {step === 0 && (
              <section>
                <h1 className="font-display text-3xl leading-tight sm:text-4xl">What are you looking for?</h1>
                <label htmlFor="role" className="mt-8 block font-mono text-xs uppercase tracking-wider text-muted">
                  Role
                </label>
                <input
                  id="role"
                  autoFocus
                  value={prefs.role}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="e.g. software engineer"
                  className="mt-2 w-full border-b-2 border-border bg-transparent py-2 font-display text-2xl outline-none transition-colors placeholder:text-muted/60 focus:border-highlight sm:text-3xl"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {ROLE_PICKS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => set("role", r.toLowerCase())}
                      className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted hover:border-foreground hover:text-foreground"
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="mt-10 font-mono text-xs uppercase tracking-wider text-muted">Level</p>
                <div className="mt-3">
                  <Segmented
                    label="Level"
                    value={prefs.seniority}
                    onChange={(v) => set("seniority", v)}
                    options={[
                      { value: "internship", label: "Internship / co-op" },
                      { value: "new_grad", label: "New grad" },
                      { value: "any", label: "Either" },
                    ]}
                  />
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <h1 className="font-display text-3xl leading-tight sm:text-4xl">Where would you work?</h1>
                <p className="mt-3 text-muted">Up to three places. Add “Remote” to include remote roles. Leave empty for anywhere.</p>
                <div className="mt-8">
                  <ChipInput
                    label="Locations"
                    values={prefs.locations}
                    onChange={(v) => set("locations", v)}
                    max={3}
                    placeholder="Type a city and press Enter"
                    suggestions={LOCATION_PICKS}
                  />
                </div>
              </section>
            )}

            {step === 2 && (
              <section>
                <h1 className="font-display text-3xl leading-tight sm:text-4xl">A little about you.</h1>
                <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted">When do you graduate?</p>
                <div className="mt-3">
                  <Segmented
                    label="Graduation year"
                    value={prefs.gradYear}
                    onChange={(v) => set("gradYear", v)}
                    options={[...GRAD_YEARS.map((y) => ({ value: y as number | null, label: String(y) })), { value: null, label: "Skip" }]}
                  />
                </div>
                <p className="mt-2 text-sm text-muted">Postings often target specific class years. We&apos;ll flag the ones that don&apos;t fit.</p>
                <div className="mt-8">
                  <Toggle
                    checked={prefs.needsVisa}
                    onChange={(v) => set("needsVisa", v)}
                    title="I need visa sponsorship"
                    body="We'll hide roles that say they won't sponsor. Roles that don't mention it stay — “not stated” isn't “no”."
                  />
                </div>
                <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted">Skills to boost (optional)</p>
                <div className="mt-3">
                  <ChipInput
                    label="Keywords"
                    values={prefs.keywords}
                    onChange={(v) => set("keywords", v)}
                    max={5}
                    placeholder="e.g. python"
                    suggestions={KEYWORD_PICKS}
                    normalize={(v) => v.trim().toLowerCase()}
                  />
                </div>
              </section>
            )}

            {step === 3 && (
              <section>
                <h1 className="font-display text-3xl leading-tight sm:text-4xl">Any companies to watch?</h1>
                <p className="mt-3 text-muted">
                  Optional. We&apos;ll read each company&apos;s <em>whole</em> job board, not just what search turns up. Use the name
                  from their careers URL — <span className="font-mono text-sm">jobs.lever.co/palantir</span> →{" "}
                  <span className="font-mono text-sm">palantir</span>.
                </p>
                <div className="mt-8">
                  <ChipInput
                    label="Companies"
                    values={prefs.companies}
                    onChange={(v) => set("companies", v)}
                    max={10}
                    placeholder="e.g. figma"
                    suggestions={COMPANY_PICKS}
                    normalize={(v) => v.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")}
                  />
                </div>
                <div className="mt-8">
                  <Toggle
                    checked={prefs.deepSearch}
                    onChange={(v) => set("deepSearch", v)}
                    title="Deep search"
                    body="Send an agent to careers sites that only work in a real browser (like Workday and Ashby). Finds more, but adds 1–3 minutes and uses paid credits."
                  />
                </div>
              </section>
            )}
          </div>

          <div className="mt-12 flex items-center justify-between gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className={`rounded-full px-4 py-3 text-muted hover:text-foreground ${step === 0 ? "invisible" : ""}`}
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={!canNext}
              className="inline-flex items-center gap-2 bg-accent px-5 py-3 font-medium text-accent-ink transition-colors enabled:hover:bg-accent/90 disabled:opacity-40"
            >
              {last ? (editing ? "Save & rescan" : "Start my radar") : "Continue"} <span aria-hidden>→</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
