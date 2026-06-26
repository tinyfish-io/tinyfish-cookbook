"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon } from "@/components/Icons";
import SendToInboxModal from "@/components/SendToInboxModal";
import type { BriefingEvent } from "@/lib/demo-data";
import { relativeTimeAgo } from "@/lib/time";

type TimelineEvent = { type: string; text?: string; toolCall?: { name: string; status: string; summary: string; details?: unknown }; error?: string; runId?: string };

type RunDetail = {
  runId: string;
  query: string;
  topic?: string;
  status: string;
  mode?: string;
  selectedVideo?: { title?: string; url?: string; videoType?: string; duration?: string; match?: string };
  playerUrl?: string;
  streamUrl?: string;
  thumbnailUrl?: string;
  events?: BriefingEvent[];
  timeline?: TimelineEvent[];
  summary?: string;
  statusMessage?: string;
  statusHistory?: Array<{ ts: string; msg: string }>;
  errorMessage?: string;
  createdAt?: string;
  completedAt?: string;
};

export default function BriefingPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reelError, setReelError] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopAutoScrollRef = useRef(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY < lastScrollYRef.current) {
        stopAutoScrollRef.current = true;
      }
      lastScrollYRef.current = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const prevStatusRef = useRef<string | undefined>(undefined);

  const fetchRun = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      const sessionToken = localStorage.getItem("session_token");
      if (sessionToken) headers["x-session-token"] = sessionToken;
      const res = await fetch(`/api/run-status/${runId}`, { headers });
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      setRun(data);
      setLoading(false);
      return data;
    } catch {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun().then((data) => {
      if (data?.status === "processing") {
        pollRef.current = setInterval(async () => {
          const updated = await fetchRun();
          if (updated && updated.status !== "processing" && pollRef.current) {
            clearInterval(pollRef.current);
          }
        }, 2000);
      }
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchRun]);

  useEffect(() => {
    if (!run) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = run.status;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (run.status === "processing") {
      if (scrollRef.current && !stopAutoScrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "end" });
      }
    } else if (prev === "processing") {
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
    }
  }, [run]);

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function openPlayer() {
    if (!run?.playerUrl) {
      setReelError(true);
      setTimeout(() => setReelError(false), 3000);
      return;
    }
    window.open(run.playerUrl, "_blank");
  }

  const embedUrl = run?.streamUrl ? `https://console.videodb.io/player?url=${encodeURIComponent(run.streamUrl)}` : undefined;

  if (loading) {
    return (
      <div className="flex flex-1">
        <div className="mx-auto max-w-[1060px] px-[22px] pt-5 pb-24 w-full">
          <div className="animate-pulse rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] p-6 space-y-4">
            <div className="h-5 w-32 rounded bg-[var(--c-hover-2)]" />
            <div className="h-8 w-3/4 rounded bg-[var(--c-hover-2)]" />
            <div className="aspect-video rounded-[12px] bg-[var(--c-hover-2)]" />
            <div className="h-4 w-full rounded bg-[var(--c-hover-2)]" />
            <div className="h-4 w-2/3 rounded bg-[var(--c-hover-2)]" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
        <p className="text-[15px] text-[var(--c-text-muted)]">Briefing not found.</p>
        <Link href="/" className="rounded-full bg-[#F24E1E] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#D14016]">
          Go home
        </Link>
      </div>
    );
  }

  const shortId = run.runId.slice(0, 8);

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1060px] px-[22px] pt-5 pb-24">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-[7px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E] active:scale-[0.98] transition-transform"
          >
            <ArrowLeftIcon className="size-3.5" /> Briefings
          </Link>
          <div className="flex items-center gap-[9px]">
            {run.status === "completed" && run.playerUrl ? (
              <>
                <button
                  type="button"
                  onClick={openPlayer}
                  className="inline-flex items-center gap-[6px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E] active:scale-[0.98] transition-transform"
                >
                  <ExternalLinkIcon className="size-3.5" /> Open
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendModal(true)}
                  className="inline-flex items-center gap-[6px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E] active:scale-[0.98] transition-transform"
                >
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Send to inbox
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex items-center gap-[6px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E] active:scale-[0.98] transition-transform"
            >
              {copied ? <><CheckIcon className="size-3.5" /> Link copied</> : <>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Share
              </>}
            </button>
          </div>
        </div>

        {reelError ? (
          <div role="alert" className="mt-3 rounded-[14px] border border-[#E5484D]/40 bg-[#E5484D]/10 p-[15px] text-[14px] font-bold text-[#E5484D]">
            Reel not available. Try refreshing or check the status.
          </div>
        ) : null}

        {run.status === "failed" ? (
          <>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#E5484D]/40 bg-[#E5484D]/10 px-3 py-[5px]">
              <span className="text-[11.5px] font-bold tracking-[0.02em] text-[#E5484D]">FAILED</span>
            </div>
            <h1 className="mt-3 max-w-[640px] text-[24px] font-extrabold tracking-[-0.02em] text-[var(--c-text)]">{run.query}</h1>
            <div className="mt-[22px] max-w-[560px] rounded-[14px] border border-[#E5484D]/40 bg-[#E5484D]/10 p-[18px]">
              <p className="text-[14px] font-bold text-[#E5484D]">We couldn&apos;t finish this reel</p>
              <p className="mt-1.5 text-[13px] text-[var(--c-text-muted)]">{run.errorMessage || "An unexpected error occurred during processing."}</p>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("open-key-modal"));
                  }
                }}
                className="mt-[14px] inline-flex items-center rounded-[11px] bg-[#F24E1E] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(242,78,30,0.24)] hover:bg-[#D14016]"
              >
                Try again
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-[18px] flex items-center gap-3">
              {run.status === "processing" ? (
                <span className="inline-flex items-center gap-[7px] rounded-full border border-[#F24E1E]/40 bg-[#F24E1E]/10 px-[13px] py-1.5">
                  <span className="status-dot-running size-2 rounded-full bg-[#F24E1E]" />
                  <span className="text-[12px] font-bold tracking-[0.02em] text-[#F24E1E]">PROCESSING</span>
                </span>
              ) : null}
              <span className="font-mono text-[12px] text-[var(--c-text-subtle)]">run {shortId}</span>
            </div>
            <h1 className="mt-[14px] max-w-[720px] text-[25px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[var(--c-text)]">{run.query}</h1>
            <div className="mx-auto mt-[26px] max-w-[720px] space-y-4">
              {embedUrl ? (
                <div className="aspect-video w-full rounded-[14px] overflow-hidden border border-[var(--c-border)] bg-black">
                  <iframe src={embedUrl} className="size-full" allow="autoplay; fullscreen" title="Video reel" />
                </div>
              ) : run.status === "completed" && run.selectedVideo?.url ? (
                <div className="relative aspect-video w-full rounded-[14px] overflow-hidden border border-[var(--c-border)] bg-black">
                  <Image src={run.selectedVideo.url} alt={run.selectedVideo.title || ""} fill className="object-cover" />
                </div>
              ) : null}

              <div className="flex items-start gap-8 flex-wrap">
                <div className="min-w-[260px]">
                  {run.summary ? <p className="mt-0 text-[14.5px] leading-relaxed text-[var(--c-text-muted)]">{run.summary}</p> : null}
                  {run.status === "completed" ? (
                    <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#F24E1E]/40 bg-[#F24E1E]/10 px-3 py-[5px]">
                      <span className="size-[7px] rounded-full bg-[#F24E1E]" />
                      <span className="text-[11.5px] font-bold tracking-[0.02em] text-[#F24E1E]">READY</span>
                    </div>
                  ) : null}
                </div>

                {run.events && run.events.length > 0 ? (
                  <div className="flex-1 min-w-0">
                    <h2 className="mb-4 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-subtle)]">Key moments</h2>
                    <div className="space-y-3">
                      {run.events.map((ev, i) => (
                        <EventCard key={i} ev={ev} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {run.status === "completed" ? (
                <div className="mt-6 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] p-[18px]">
                  <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-subtle)]">Source video</h2>
                  <div className="flex items-center gap-[10px]">
                    <Image src="/brand/icon-videodb.png" alt="" width={18} height={18} className="size-[18px] rounded-[4px] flex-none" />
                    <a
                      href={run.selectedVideo?.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13.5px] font-semibold leading-relaxed text-[#F24E1E] no-underline hover:underline"
                    >
                      {run.selectedVideo?.title || "Unknown video"} <ExternalLinkIcon className="size-3.5 inline-block" />
                    </a>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] p-[18px]">
                <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--c-text-subtle)]">Run details</h2>
                <div className="space-y-2">
                  <div className="flex justify-between text-[12.5px]"><span className="text-[var(--c-text-subtle)]">Mode</span><span className="font-semibold text-[#F24E1E]">{run.mode || "live"}</span></div>
                  <div className="flex justify-between text-[12.5px]"><span className="text-[var(--c-text-subtle)]">Status</span><span className="font-semibold text-[var(--c-text)]">{run.status}</span></div>
                  {run.createdAt ? <div className="flex justify-between text-[12.5px]"><span className="text-[var(--c-text-subtle)]">Created</span><span className="font-semibold text-[var(--c-text)]">{relativeTimeAgo(run.createdAt)}</span></div> : null}
                  {run.completedAt ? <div className="flex justify-between text-[12.5px]"><span className="text-[var(--c-text-subtle)]">Completed</span><span className="font-semibold text-[var(--c-text)]">{relativeTimeAgo(run.completedAt)}</span></div> : null}
                </div>
              </div>
              <div ref={scrollRef} />
            </div>
          </>
        )}

        <div ref={scrollRef} />
      </div>
      <SendToInboxModal
        runId={run.runId}
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
      />
    </div>
  );
}

function EventCard({ ev }: { ev: BriefingEvent }) {
  return (
    <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] p-[15px] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-bold text-[var(--c-text)] line-clamp-2">{ev.label || "Untitled moment"}</span>
        {ev.timestamp ? (
          <span className="font-mono text-[13px] font-medium text-[#F24E1E]">{ev.timestamp || "—"}</span>
        ) : null}
      </div>
      {ev.query ? (
        <p className="text-[13px] text-[var(--c-text-muted)] line-clamp-2 leading-relaxed">{ev.query}</p>
      ) : null}
    </div>
  );
}
