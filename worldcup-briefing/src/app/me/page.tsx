"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BriefingCard from "@/components/BriefingCard";
import { Pagination } from "@/components/Pagination";
import { ArrowLeftIcon, ArrowRightIcon, SearchIcon } from "@/components/Icons";

type RunItem = {
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

function MyBriefingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasKeys, setHasKeys] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const searchParam = searchParams.get("search") ?? "";
  const showingFailed = searchParams.get("status") === "failed";

  useEffect(() => {
    setSearch(searchParam);
  }, [searchParam]);

  const pushSearch = useCallback(
    (text: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (text) {
        params.set("search", text);
      } else {
        params.delete("search");
      }
      const query = params.toString();
      router.push(query ? `/me?${query}` : "/me", { scroll: false });
    },
    [router, searchParams],
  );

  function onSearch(text: string) {
    setSearch(text);
    setPage(1);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => pushSearch(text), 300);
  }

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (token) setHasKeys(true);
  }, []);

  useEffect(() => {
    if (!hasKeys) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchRuns() {
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) return;
      const url = new URL("/api/my-runs", window.location.origin);
      if (searchParam) url.searchParams.set("search", searchParam);
      if (showingFailed) url.searchParams.set("status", "failed");
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", "15");
      const res = await fetch(url.toString(), {
        headers: { "x-session-token": sessionToken },
      });
      const data = await res.json();
      if (cancelled) return;
      const next = (data.runs || []) as RunItem[];
      setRuns(next);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);

      if (next.some((r) => r.status === "processing")) {
        if (!pollRef.current) {
          pollRef.current = setInterval(fetchRuns, 10000);
        }
      } else if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    async function initialLoad() {
      setLoading(true);
      try {
        await fetchRuns();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialLoad();
    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasKeys, searchParam, page, showingFailed]);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
  }, []);

  const toggleFailedRuns = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (showingFailed) {
      params.delete("status");
    } else {
      params.set("status", "failed");
    }
    setPage(1);
    const query = params.toString();
    router.push(query ? `/me?${query}` : "/me");
  }, [router, searchParams, showingFailed]);

  if (!hasKeys) {
    return (
      <div className="flex-1">
        <div className="mx-auto max-w-[1080px] px-[22px] pt-5 pb-24">
          <Link
            href="/"
            className="inline-flex items-center gap-[7px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E] active:scale-[0.98] transition-transform"
          >
            <ArrowLeftIcon className="size-3.5" /> Home
          </Link>
          <div className="flex flex-col items-center justify-center py-16 text-center max-w-[480px] mx-auto">
            <span className="inline-flex size-[56px] items-center justify-center rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[#F24E1E] shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
              </svg>
            </span>
            <h1 className="mt-5 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--c-text)]">
              Your personal briefing library
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--c-text-subtle)]">
              Save your API keys to generate and revisit your custom match moment reels anytime. Every briefing you create is saved here.
            </p>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-key-modal"));
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#F24E1E] px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_2px_10px_rgba(242,78,30,0.26)] transition-all duration-200 hover:bg-[#D14016] active:scale-[0.98]"
            >
              Add API keys <ArrowRightIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1080px] px-[22px] pt-5 pb-24">
        <Link
          href="/"
          className="inline-flex items-center gap-[7px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E] active:scale-[0.98] transition-transform"
        >
          <ArrowLeftIcon className="size-3.5" /> Home
        </Link>

        <div className="mt-[18px] flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[27px] font-extrabold tracking-[-0.02em] text-[var(--c-text)]">
              {showingFailed ? "Failed runs" : "My briefings"}
            </h1>
            {!loading ? (
              <p className="mt-1.5 text-[14px] text-[var(--c-text-subtle)]">
                {showingFailed ? "Runs that did not complete" : "Every reel you&apos;ve generated"} · {total} {searchParam ? "matched" : "total"}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-[9px]">
            <div className="flex items-center gap-[9px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[14px] py-[9px] shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
              <SearchIcon className="size-[14px] text-[var(--c-text-subtle)] shrink-0" />
              <input
                type="text"
                aria-label="Search your briefings"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search your briefings…"
                className="w-[140px] sm:w-[180px] border-none bg-transparent text-[14px] text-[var(--c-text)] outline-none placeholder:text-[var(--c-text-subtle)] focus-visible:ring-2 focus-visible:ring-[#F24E1E]/40 focus-visible:ring-offset-1"
              />
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-full bg-[#F24E1E] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(242,78,30,0.24)] transition-all duration-200 hover:bg-[#D14016] active:scale-[0.98]"
            >
              + New briefing
            </Link>
          </div>
        </div>

        {loading ? (
          <div
            className="mt-[22px] grid gap-[18px] min-w-0 ds-briefing-grid"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse motion-reduce:animate-none rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)]"
              >
                <div className="aspect-video rounded-t-[15px] bg-[var(--c-hover-2)]" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-[var(--c-hover-2)]" />
                  <div className="h-3 w-full rounded bg-[var(--c-hover-2)]" />
                  <div className="h-3 w-1/3 rounded bg-[var(--c-hover-2)]" />
                </div>
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[15px] text-[var(--c-text-muted)]">
              {searchParam
                ? "No briefings match your search."
                : showingFailed
                  ? "No failed runs."
                  : "No briefings yet."}
            </p>
            {!showingFailed ? (
              <Link href="/" className="mt-3 text-[13px] font-bold text-[#F24E1E] hover:underline">
                Create your first briefing <ArrowRightIcon className="size-3.5 inline-block" />
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div
              className="mt-[22px] grid gap-[18px] min-w-0"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))" }}
            >
              {runs.map((run) => (
                <BriefingCard key={run.id} run={run} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}

        {!loading ? (
          <div className="mt-8 flex justify-center border-t border-[var(--c-border)] pt-5">
            <button
              type="button"
              onClick={toggleFailedRuns}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-[var(--c-text-subtle)] transition-colors hover:bg-[var(--c-hover)] hover:text-[var(--c-text-muted)]"
            >
              {showingFailed ? "Show completed runs" : "Show failed runs"}
              {showingFailed ? (
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              ) : (
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function MyBriefings() {
  return (
    <Suspense fallback={
      <div className="flex-1">
        <div className="mx-auto max-w-[1080px] px-[22px] pt-5 pb-24">
          <div className="mt-[22px] grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse motion-reduce:animate-none rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)]">
                <div className="aspect-video rounded-t-[15px] bg-[var(--c-hover-2)]" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-[var(--c-hover-2)]" />
                  <div className="h-3 w-full rounded bg-[var(--c-hover-2)]" />
                  <div className="h-3 w-1/3 rounded bg-[var(--c-hover-2)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      }>
      <MyBriefingsContent />
    </Suspense>
  );
}
