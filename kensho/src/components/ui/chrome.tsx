"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLibrary } from "@/lib/library";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 group shrink-0 ${className}`} aria-label="Kenshō home">
      <span className="grid place-items-center w-9 h-9 bg-ink text-white font-display text-[15px] leading-none group-hover:bg-red group-hover:-rotate-6 transition-all">見</span>
      <span className="font-display text-[19px] tracking-[0.06em] leading-none hidden sm:inline">
        KENSHŌ<span className="text-red">.</span>
      </span>
    </Link>
  );
}

export type JourneyStep = "discover" | "paper" | "read";
const STEPS: { key: JourneyStep; n: string; label: string }[] = [
  { key: "discover", n: "01", label: "Discover" },
  { key: "paper", n: "02", label: "Paper" },
  { key: "read", n: "03", label: "Read" },
];

/** Where the reader is in Open → Discover → Paper → Read, always visible in the header. */
function Journey({ step }: { step?: JourneyStep }) {
  const at = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="hidden md:flex items-center gap-1 font-mono text-[11px] tracking-[0.14em]" aria-label="Your progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1" aria-current={i === at ? "step" : undefined}>
          {i > 0 && <span className={`w-5 h-[2px] ${i <= at ? "bg-ink" : "bg-ink/20"}`} aria-hidden />}
          <span className={`px-1.5 py-0.5 ${i === at ? "bg-ink text-white" : i < at ? "text-ink" : "text-ink/35"}`}>
            {s.n} {s.label.toUpperCase()}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ContinuePill() {
  const lib = useLibrary();
  const latest = Object.entries(lib.progress).sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))[0];
  if (!latest) return null;
  const [id, p] = latest;
  return (
    <Link
      href={`/read/${id}?ch=${p.chapter}&p=${p.page}`}
      className="hidden lg:flex items-center gap-2 max-w-[260px] border-2 border-ink bg-white pl-2 pr-3 py-1 text-xs font-bold hover:bg-ink hover:text-white transition-colors"
      title={`Continue: ${p.title}`}
    >
      <span className="bg-red text-white font-display text-[10px] px-1.5 py-0.5 shrink-0">続き</span>
      <span className="truncate">{p.title}</span>
      <span className="font-mono shrink-0">CH.{p.chapter}</span>
    </Link>
  );
}

export function SiteHeader({ step }: { step?: JourneyStep }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-16 flex items-center gap-4 sm:gap-6">
        <Logo />
        <Journey step={step} />
        <nav className="ml-auto flex items-center gap-1 text-sm font-bold">
          <ContinuePill />
          <NavLink href="/search" active={pathname.startsWith("/search")}>
            Discover
          </NavLink>
          <NavLink href="/library" active={pathname.startsWith("/library")}>
            Library
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`px-3 py-2 transition-colors ${active ? "bg-ink text-white" : "hover:bg-ink hover:text-white"}`}>
      {children}
    </Link>
  );
}

const PLACEHOLDERS = ["How do large language models work?", "How does blockchain consensus work?", "Can AI detect diseases?", "How do neural networks learn?", "What is CRISPR gene editing?"];

export function SearchBar({ initial = "", size = "lg", autoFocus = false }: { initial?: string; size?: "lg" | "md"; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [ph, setPh] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Rotating example questions teach the user that plain-language questions work.
  useEffect(() => {
    if (initial) return;
    const t = setInterval(() => setPh((n) => (n + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(t);
  }, [initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (v.length < 2) {
      input.current?.focus();
      return;
    }
    setBusy(true);
    router.push(`/search?q=${encodeURIComponent(v)}`);
    setTimeout(() => setBusy(false), 1200);
  };
  const lg = size === "lg";
  return (
    <form onSubmit={submit} role="search" className={`search-bar relative flex items-stretch bg-white border-[3px] border-ink transition-shadow focus-within:shadow-[8px_8px_0_var(--red)] ${lg ? "ink-shadow" : "ink-shadow-sm"}`}>
      <label htmlFor="topic" className="sr-only">
        What do you want to understand?
      </label>
      <span aria-hidden className="grid place-items-center pl-4 pr-1">
        <svg width={lg ? 24 : 18} height={lg ? 24 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="10" cy="10" r="6.5" />
          <path d="M15 15 L21 21" strokeLinecap="square" />
        </svg>
      </span>
      <input
        ref={input}
        id="topic"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        maxLength={200}
        enterKeyHint="search"
        placeholder={PLACEHOLDERS[ph]}
        className={`flex-1 min-w-0 bg-transparent outline-none focus-visible:outline-none px-3 placeholder:text-ink-3/60 font-medium ${lg ? "py-4 sm:py-5 text-lg sm:text-xl" : "py-2.5 text-base"}`}
      />
      <button
        type="submit"
        disabled={busy}
        className={`bg-ink text-white font-display tracking-wider hover:bg-red transition-colors disabled:bg-red ${lg ? "px-5 sm:px-8 text-base sm:text-lg" : "px-4 text-sm"}`}
      >
        {busy ? "…" : lg ? (<><span className="hidden sm:inline">FIND PAPERS</span><span className="sm:hidden">FIND</span></>) : "SEARCH"}
      </button>
    </form>
  );
}

export function Footer() {
  const credits = [
    ["STORY", "The authors of every paper"],
    ["RESEARCH SCOUTING", "TinyFish Search · Fetch · Agent"],
    ["SCRIPT", "Gemini, checked against the source"],
    ["CAST", "Prof. Hoshi · Kai · Sumi"],
    ["SCREENTONE", "Hand-set halftone, 6px"],
  ];
  return (
    <footer className="mt-24 bg-ink text-white border-t-[3px] border-ink relative overflow-hidden">
      <div className="absolute inset-0 tone-dots invert opacity-[0.04] pointer-events-none" />
      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="font-display text-red text-xs tracking-[0.3em]">つづく</div>
          <div className="font-display text-4xl sm:text-5xl mt-2 leading-none">TO BE CONTINUED</div>
          <p className="text-sm text-white/65 mt-5 max-w-xl leading-relaxed">
            <em>Kenshō</em> (見性) means “seeing into the nature of things.” Papers are discovered on the open web; Kenshō reads only openly accessible text, quotes
            it briefly, and always links back to the source. Panels simplify — the paper is the authority.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/search" className="border-2 border-white px-3 py-1.5 hover:bg-white hover:text-ink transition-colors">
              Find a paper
            </Link>
            <a href="/?intro=1" className="border-2 border-white/40 px-3 py-1.5 hover:border-white transition-colors">
              ↺ Replay opening
            </a>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 self-end font-mono text-xs">
          {credits.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-white/45 tracking-[0.18em]">{k}</dt>
              <dd className="text-white/90">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </footer>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs" role="status">
      <span className="w-3 h-3 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      {label}
    </span>
  );
}
