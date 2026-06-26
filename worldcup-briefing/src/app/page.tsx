"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BriefingCard from "@/components/BriefingCard";
import LowCreditsBanner from "@/components/LowCreditsBanner";
import OnboardingStepper from "@/components/onboarding-stepper";
import { ArrowRightIcon, CalendarIcon, SearchIcon, TargetIcon } from "@/components/Icons";
import { formatHourMinute, relativeTimeUntil } from "@/lib/time";

const FREE_RUN_LIMIT = 3;

const suggestions = [
  { text: "Manchester United Women Goals 2024", runId: "fec0a34a-d0df-410d-885f-cd4ed1bc82d1" },
  { text: "Barcelona vs Manchester United foul moments", runId: "11f29b6c-46c0-4963-9934-324bf4aa0e88" },
  { text: "Real Madrid vs Barcelona Fouls", runId: "c95eee60-701f-4cca-a63f-4c0ea92e6b41" },
  { text: "France vs Portugal Goals 2024-25", runId: "655b89b4-14f6-455a-9b07-fb57680008ec" },
];

type PreviewRun = {
  id: string;
  query?: string;
  topic?: string;
  status?: string;
  player_url?: string;
  thumbnail_url?: string;
  summary?: string;
  events?: unknown[];
  created_at?: string;
};

type ScheduleItem = {
  id: string;   query: string; runTime: string; timezone: string; channel: string;
  channelConfig: { channelIds?: string[] }; isActive: boolean;
  nextRunAt: string | null; lastRunAt: string | null; createdAt: string | null;
};

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [previewRuns, setPreviewRuns] = useState<PreviewRun[]>([]);
  const [previewType, setPreviewType] = useState<"personal" | "public">("public");
  const [previewLoading, setPreviewLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [freeRunCount, setFreeRunCount] = useState(0);
  const [freeRunsExhausted, setFreeRunsExhausted] = useState(false);
  const [selectedSuggestionRunId, setSelectedSuggestionRunId] = useState<string | null>(null);
  const [suggestionFocusIdx, setSuggestionFocusIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trigger, setTrigger] = useState(0);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    if (!hasSession) { setSchedules([]); return; }
    const sessionToken = localStorage.getItem("session_token");
    fetch("/api/schedules", { headers: { "x-session-token": sessionToken! } })
      .then((r) => r.json())
      .then((d) => setSchedules(d.schedules || []))
      .catch(() => {});
  }, [hasSession, trigger]);

  useEffect(() => {
    const hasToken = !!localStorage.getItem("session_token");
    setHasSession(hasToken);
    setKeysLoaded(true);
    if (!hasToken) {
      const count = parseInt(sessionStorage.getItem("free_run_count") || "0", 10);
      setFreeRunCount(count);
      if (count >= FREE_RUN_LIMIT) setFreeRunsExhausted(true);
    }
  }, []);

  useEffect(() => {
    function onSessionChange() {
      setHasSession(!!localStorage.getItem("session_token"));
      setTrigger((t) => t + 1);
    }
    window.addEventListener("session_changed", onSessionChange);
    return () => window.removeEventListener("session_changed", onSessionChange);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        e.target !== inputRef.current
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!keysLoaded) return;

    async function fetchMyRuns() {
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) return [];
      try {
        const res = await fetch("/api/my-runs?limit=6", { headers: { "x-session-token": sessionToken } });
        const data = await res.json();
        return (data.runs || []) as PreviewRun[];
      } catch {
        return [];
      }
    }

    async function loadPreview() {
      setPreviewLoading(true);

      const myRuns = await fetchMyRuns();
      if (myRuns.length > 0) {
        setPreviewRuns(myRuns.slice(0, 6));
        setPreviewType("personal");

        if (myRuns.some((r) => r.status === "processing")) {
          if (!pollRef.current) {
            pollRef.current = setInterval(async () => {
              const updated = await fetchMyRuns();
              setPreviewRuns(updated.slice(0, 6));
              setPreviewType("personal");
              if (!updated.some((r) => r.status === "processing") && pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
            }, 10000);
          }
        }

        setPreviewLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/gallery?limit=6");
        const data = await res.json();
        setPreviewRuns((data.runs || []).slice(0, 6));
        setPreviewType("public");
      } catch {} finally {
        setPreviewLoading(false);
      }
    }
    loadPreview();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [keysLoaded, trigger]);

  function handleSearch(text: string) {
    setSearch(text);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      if (text.trim()) {
        router.push(previewType === "personal" ? `/me?search=${encodeURIComponent(text)}` : `/gallery?search=${encodeURIComponent(text)}`);
      }
    }, 400);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isRunning) return;

    if (!hasSession && freeRunsExhausted) {
      openKeysModal();
      return;
    }

    setIsRunning(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const sessionToken = localStorage.getItem("session_token");
      if (sessionToken) headers["x-session-token"] = sessionToken;

      const res = await fetch("/api/agent", {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "free_runs_exhausted") {
          sessionStorage.setItem("free_run_count", String(FREE_RUN_LIMIT));
          setFreeRunCount(FREE_RUN_LIMIT);
          setFreeRunsExhausted(true);
        }
        setIsRunning(false);
        return;
      }

      if (!res.body) {
        setIsRunning(false);
        return;
      }

      const isFreeRun = !sessionToken;
      if (isFreeRun) {
        const next = freeRunCount + 1;
        sessionStorage.setItem("free_run_count", String(next));
        setFreeRunCount(next);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let found = false;
      while (!found) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "run_id" && event.runId) {
              found = true;
              reader.cancel();
              router.push(`/b/${event.runId}`);
              return;
            }
          } catch {}
        }
      }
      reader.cancel();
    } catch {
    } finally {
      setIsRunning(false);
    }
  }

  function selectSuggestion(text: string, runId: string) {
    if (!hasSession) {
      setSelectedSuggestionRunId(runId);
      setTimeout(() => setShowSuggestions(false), 260);
      setTimeout(() => router.push(`/replay/${runId}`), 320);
      return;
    }
    setShowSuggestions(false);
    setPrompt(text);
    inputRef.current?.focus();
  }

  function handleSuggestionKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionFocusIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && suggestionFocusIdx >= 0) {
      e.preventDefault();
      const s = suggestions[suggestionFocusIdx];
      selectSuggestion(s.text, s.runId);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      inputRef.current?.focus();
    }
  }

  function openKeysModal() {
    window.dispatchEvent(new CustomEvent("open-key-modal"));
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-[1080px] px-[22px]">
        <section className="pb-[30px] pt-16 text-center">
          <span className="ds-eyebrow ds-eyebrow--orange mb-5 block">TinyFish × VideoDB · Soccer agent</span>
          <h1 className="mx-auto mt-1 max-w-[660px] text-[clamp(32px,6vw,52px)] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--c-text)]">
            Your daily soccer briefing, on{"\u00A0"}demand
          </h1>
          <p className="mx-auto mt-4 max-w-[500px] text-[16px] leading-relaxed text-[var(--c-text-muted)]">
            Search any match moment and get a playable reel — or set up a daily AI digest delivered to your Telegram, Discord, or Slack.
          </p>

          <div className="relative mx-auto mt-[30px] max-w-[640px]">
            <form onSubmit={handleSubmit} className="flex items-center gap-[10px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] py-2 pl-5 pr-2 shadow-[0_8px_30px_rgba(0,0,0,0.4)] focus-within:border-[#F24E1E]/50 transition-colors duration-200">
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                aria-label="Search for match moments"
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Ask for any match moment…"
                disabled={isRunning}
                className="flex-1 border-none bg-transparent py-3 pl-2 text-[15.5px] text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-faint)] rounded-full disabled:opacity-50"
                style={{ outline: "none" }}
              />
              <button
                type="submit"
                disabled={!prompt.trim() || isRunning}
                className="flex items-center gap-2 rounded-full bg-[#F24E1E] px-5 py-[11px] text-[14px] font-medium text-white shadow-[0_2px_10px_rgba(242,78,30,0.3)] transition-all duration-200 hover:bg-[#D14016] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--c-hover-2)] disabled:text-[var(--c-text-faint)] disabled:shadow-none"
              >
                Run<ArrowRightIcon className="size-[14px]" />
              </button>
            </form>

            {showSuggestions ? (
              <div
                ref={suggestionsRef}
                role="listbox"
                aria-label="Suggested briefings"
                className="absolute inset-x-0 top-16 z-20 rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] p-2 text-left shadow-[0_14px_40px_rgba(0,0,0,0.5)] animate-rise"
                onKeyDown={handleSuggestionKeyDown}
              >
                <p className="mx-3 mb-1.5 mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
                  Try one of these
                </p>
                {suggestions.map((ex, idx) => (
                  <button
                    key={ex.runId}
                    type="button"
                    role="option"
                    aria-selected={idx === suggestionFocusIdx}
                    onMouseDown={() => selectSuggestion(ex.text, ex.runId)}
                    onMouseEnter={() => setSuggestionFocusIdx(idx)}
                    tabIndex={-1}
                    className={`flex w-full items-center gap-[11px] rounded-[11px] px-3 py-2.5 text-left transition-all duration-200 hover:bg-[var(--c-hover)] ${
                      selectedSuggestionRunId === ex.runId
                        ? "scale-[0.99] bg-[#F24E1E]/[0.12] shadow-[0_0_0_1px_rgba(242,78,30,0.35)]"
                        : ""
                    } ${
                      idx === suggestionFocusIdx && selectedSuggestionRunId !== ex.runId
                        ? "bg-[var(--c-hover)]"
                        : ""
                    }`}
                  >
                    <span className="flex size-6 flex-none items-center justify-center rounded-[7px] bg-[var(--c-hover-2)] text-[12px] text-[var(--c-text-subtle)]" aria-hidden="true">
                      <SearchIcon className="size-3.5" />
                    </span>
                  <span className="text-[14px] text-[var(--c-text-muted)]">{ex.text}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {!hasSession && !freeRunsExhausted ? (
            <div className="mx-auto mt-4 max-w-[640px] flex items-center justify-center gap-3 text-[13.5px]">
              <button type="button" onClick={openKeysModal} className="rounded-full border border-[var(--c-border)] bg-[var(--c-hover)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--c-text-subtle)] transition-colors hover:border-[#F24E1E]/40 hover:text-[var(--c-text)]">
                Use your own keys
              </button>
              <span className="font-semibold text-[var(--c-text-subtle)]">
                {FREE_RUN_LIMIT - freeRunCount} free run{FREE_RUN_LIMIT - freeRunCount === 1 ? "" : "s"} left
              </span>
            </div>
          ) : freeRunsExhausted && !hasSession ? (
            <div className="mt-4 mx-auto max-w-[640px] rounded-[14px] border border-[#F24E1E]/30 bg-[#F24E1E]/5 px-5 py-4 text-center">
              <p className="text-[13.5px] text-[var(--c-text-muted)]">
                You&apos;ve used your {FREE_RUN_LIMIT} free runs.{" "}
                <button type="button" onClick={openKeysModal} className="font-semibold text-[#F24E1E] hover:underline">
                  Add your own API keys
                </button>{" "}
                to keep going.
              </p>
            </div>
          ) : null}
        <LowCreditsBanner />
        </section>
      </div>

      {(!hasSession || schedules.filter((s) => s.isActive).length === 0) ? (
        <OnboardingStepper
          hasSession={hasSession}
          onScheduleCreated={() => setTimeout(() => setTrigger((t) => t + 1), 400)}
        />
      ) : null}

      <div className="mx-auto w-full max-w-[1080px] px-[22px] pb-24">
        {hasSession && schedules.filter((s) => s.isActive).length > 0 ? (
          <section className="mt-[34px]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-medium tracking-[-0.01em] text-[var(--c-text)]">
                  Your schedules
                </h2>
                <p className="mt-[5px] text-[13px] text-[var(--c-text-subtle)]">
                  Daily briefings running automatically
                </p>
              </div>
              <Link href="/schedules" className="ds-btn ds-btn--ghost-dark ds-btn--sm">
                Manage all <ArrowRightIcon className="size-3.5" />
              </Link>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {schedules.filter((s) => s.isActive).slice(0, 3).map((s) => (
                <Link
                  key={s.id}
                  href={`/schedules/${s.id}`}
                  className="ds-card ds-card--dark is-interactive flex items-center justify-between gap-4 px-5 py-4 hover:border-[#F24E1E]/50 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border border-[var(--c-border)] bg-[var(--c-hover)] text-[#F24E1E]">
                      <CalendarIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[var(--c-text)]">
                        {s.query}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--c-text-subtle)]">
                        Daily at {formatHourMinute(s.runTime)} · via {s.channel}
                        {s.nextRunAt ? ` · next ${relativeTimeUntil(s.nextRunAt)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={s.isActive ? "ds-pill-status ds-pill-status--orange" : "ds-pill-status ds-pill-status--muted-dark"}>
                      {s.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-[34px]">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-[20px] font-medium tracking-[-0.01em] text-[var(--c-text)]">
                {previewType === "personal" ? "Your briefings" : "Public briefings"}
              </h2>
              <p className="mt-[5px] text-[13px] text-[var(--c-text-subtle)]">
                {previewType === "personal" ? "Reels you have generated" : "Curated World Cup match moments"}
              </p>
            </div>
            <div className="flex items-center gap-[10px]">
              <div className="flex items-center gap-2 rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-2 focus-within:border-[#F24E1E]/50 transition-colors">
                <SearchIcon className="size-3.5 text-[var(--c-text-faint)] shrink-0" />
                <input
                  aria-label="Search briefings"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-[120px] sm:w-[180px] border-none bg-transparent text-[13.5px] text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-faint)]"
                />
              </div>
              <Link href={previewType === "personal" ? "/me" : "/gallery"} className="ds-btn ds-btn--ghost-dark ds-btn--sm">
                View all <ArrowRightIcon className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-[18px] min-w-0 ds-briefing-grid">
            {previewLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse motion-reduce:animate-none rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)]">
                  <div className="aspect-video rounded-t-[15px] bg-[var(--c-hover-2)]" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-3/4 rounded bg-[var(--c-hover-2)]" />
                    <div className="h-3 w-full rounded bg-[var(--c-hover-2)]" />
                    <div className="h-3 w-1/3 rounded bg-[var(--c-hover-2)]" />
                  </div>
                </div>
              ))
            ) : previewRuns.length === 0 ? (
              <div className="rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center col-span-full">
                <p className="text-[14px] text-[var(--c-text-muted)]">No briefings yet.</p>
                <p className="mt-1 text-[13px] text-[var(--c-text-faint)]">Create one with the compose bar above.</p>
              </div>
            ) : (
              previewRuns.map((run) => (
                <BriefingCard key={run.id} run={run} />
              ))
            )}
          </div>

          {previewType === "personal" && !previewLoading ? (
            <Link
              href="/gallery"
              className="mt-[18px] flex w-full items-center justify-between rounded-[14px] border border-[var(--c-border)] bg-[var(--c-hover)] px-5 py-4 hover:border-[#F24E1E]/50 transition-colors duration-200 active:scale-[0.98]"
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex size-[34px] items-center justify-center rounded-[9px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[#F24E1E]">
                  <TargetIcon className="size-4" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-[var(--c-text)]">Explore the public gallery</span>
                  <span className="mt-px block text-[12.5px] text-[var(--c-text-faint)]">Curated World Cup reels from the community</span>
                </span>
              </span>
              <ArrowRightIcon className="size-4 text-[var(--c-text-faint)]" />
            </Link>
          ) : null}
        </section>


      </div>
    </main>
  );
}
