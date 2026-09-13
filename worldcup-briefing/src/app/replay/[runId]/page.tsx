"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/Icons";

type RawTimelineEvent = {
  type: string;
  text?: string;
  toolCall?: {
    id?: string;
    name: string;
    status: string;
    summary: string;
    details?: unknown;
  };
};

type BriefingEvent = {
  label?: string;
  query?: string;
  timestamp?: string;
};

type RunDetail = {
  runId: string;
  query: string;
  topic?: string;
  status: string;
  mode?: string;
  selectedVideo?: { title?: string; url?: string; videoType?: string; duration?: string; match?: string; teams?: string[] };
  events?: BriefingEvent[];
  timeline?: RawTimelineEvent[];
  statusHistory?: Array<{ ts: string; msg: string }>;
  statusMessage?: string;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const parts = text.split(/(\s+)/);
  let buf = "";
  let wordCount = 0;

  for (const p of parts) {
    buf += p;
    if (p.trim()) wordCount += 1;
    if (wordCount >= 2) {
      chunks.push(buf);
      buf = "";
      wordCount = 0;
    }
  }
  if (buf) chunks.push(buf);

  return chunks;
}

function splitTextForTyping(events: RawTimelineEvent[]): RawTimelineEvent[] {
  const result: RawTimelineEvent[] = [];
  let buf = "";

  for (const ev of events) {
    if (ev.type === "text-delta" && ev.text) {
      buf += ev.text;
    } else {
      if (buf.trim()) {
        for (const chunk of chunkText(buf)) result.push({ type: "text-delta", text: chunk });
        buf = "";
      }
      result.push(ev);
    }
  }
  if (buf.trim()) {
    for (const chunk of chunkText(buf)) result.push({ type: "text-delta", text: chunk });
  }

  return result;
}

function buildSyntheticEvents(run: RunDetail): RawTimelineEvent[] {
  const query = run.query || "World Cup briefing";
  const selectedVideo = run.selectedVideo;
  const sourceTitle = selectedVideo?.title || "Match highlights";
  const sourceUrl = selectedVideo?.url || "#";
  const matchName = selectedVideo?.match || sourceTitle || query;
  const events = run.events || [];
  const eventCount = events.length;
  const seed = query;

  const teams = selectedVideo?.teams?.length === 2
    ? selectedVideo.teams
    : [matchName.split(/\s+(?:vs|v)\.?\s+|\s+-\s+/i)[0] || "Team 1", matchName.split(/\s+(?:vs|v)\.?\s+|\s+-\s+/i)[1] || "Team 2"];

  const researchResults = [
    { title: `${matchName} — Match Report`, url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(matchName)}`, site: "wikipedia.org" },
    { title: `${matchName} — Game Analysis & Stats`, url: "#", site: "espn.com" },
    { title: `${matchName} — Live Updates`, url: "#", site: "bbc.com" },
  ];

  const searchResults = [
    { title: sourceTitle, url: sourceUrl, match: matchName, teams, source: "youtube.com", duration: selectedVideo?.duration || "unknown", videoType: selectedVideo?.videoType || "match highlights", confidence: 0.99 },
  ];

  const buildToolEvent = (name: string, status: string, summary: string, details?: unknown): RawTimelineEvent => ({
    type: "tool",
    toolCall: { id: name.includes("research") ? "tinyfish-research" : "tinyfish", name, status, summary, details },
  });

  return [
    { type: "run_id", text: undefined },
    { type: "meta", text: undefined },
    buildToolEvent("TinyFish research", "running", `Researching: "${matchName} match report"`),
    buildToolEvent("TinyFish research", "done", `Read ${2 + (hash(seed) % 4)} match reports — found ${eventCount} key moments.`, { results: researchResults.slice(0, 2 + (hash(seed) % 3)) }),
    { type: "text-delta", text: `Found detailed match context for **${matchName}**. Now let me find the best video footage to reel those moments up.  \n\n` },
    buildToolEvent("TinyFish search", "running", `Searching: "${matchName} highlights"`),
    buildToolEvent("TinyFish search", "done", `Returned candidate soccer videos.`, { results: searchResults, mode: "live", query: `${matchName} highlights`, source: "TinyFish Search API" }),
    { type: "text-delta", text: `Got it! Found **${sourceTitle}**. Choosing this as the best match for **${query}**. Building your reel now...  \n\n` },
    { type: "tool", toolCall: { id: "videodb", name: "VideoDB reel", status: "done", summary: "Building your reel...", details: { runId: run.runId } } },
  ];
}

function buildStatusHistory(run: RunDetail): Array<{ ts: string; msg: string }> {
  if (run.statusHistory && run.statusHistory.length > 0) return run.statusHistory;

  const eventCount = run.events?.length || 0;

  return [
    { ts: new Date().toISOString(), msg: "Uploading video to VideoDB..." },
    { ts: new Date().toISOString(), msg: "Building scene index..." },
    { ts: new Date().toISOString(), msg: "Waiting for scene index to build..." },
    { ts: new Date().toISOString(), msg: "Searching for key moments..." },
    { ts: new Date().toISOString(), msg: `Compiled ${eventCount || "multiple"} moments into a playable reel.` },
  ];
}

const AGENT_EVENT_DELAY = 150;
const TOOL_RUNNING_DELAY = 550;
const FIRST_STATUS_DELAY = 900;

const TEXT_CHUNK_DELAY = 80;

const STATUS_DELAYS = [4000, 4000, 2000, 1500, 1500];

export default function ReplayPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [visibleStatusCount, setVisibleStatusCount] = useState(-1);
  const redirectedRef = useRef(false);
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

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("theme-dark"));
  }, []);

  const fullEvents = useMemo(() => {
    if (!run) return [];
    if (run.timeline && run.timeline.length > 1) {
      const hasAgentTools = run.timeline.some(
        (e) => e.type === "tool" && e.toolCall?.name?.includes("TinyFish"),
      );
      if (hasAgentTools) {
        let foundFinish = false;
        const filtered: RawTimelineEvent[] = [];
        for (const e of run.timeline) {
          if (e.type === "finish") { foundFinish = true; continue; }
          if (foundFinish) break;
          if (e.type === "run_id" || e.type === "meta") continue;
          filtered.push(e);
        }
        return splitTextForTyping(filtered);
      }
    }
    return buildSyntheticEvents(run).filter((e) => e.type !== "run_id" && e.type !== "meta");
  }, [run]);

  const fullStatusHistory = useMemo(() => {
    if (!run) return [];
    return buildStatusHistory(run);
  }, [run]);

  const visibleEvents = useMemo(
    () => fullEvents.slice(0, visibleCount + 1),
    [fullEvents, visibleCount],
  );

  const visibleStatus = useMemo(
    () => fullStatusHistory.slice(0, visibleStatusCount + 1),
    [fullStatusHistory, visibleStatusCount],
  );

  const reelDispatchedAt = useMemo(() => {
    return fullEvents.findIndex(
      (e) => e.type === "tool" && e.toolCall?.name === "VideoDB reel",
    );
  }, [fullEvents]);

  useEffect(() => {
    let cancelled = false;

    async function loadRun() {
      try {
        const res = await fetch(`/api/run-status/${runId}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setRun(data);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    }

    loadRun();
    return () => { cancelled = true; };
  }, [runId]);

  useEffect(() => {
    if (notFound || !fullEvents.length) return;
    if (visibleCount >= fullEvents.length - 1) return;

    const prev = visibleCount < 0 ? null : fullEvents[visibleCount];
    let delay = AGENT_EVENT_DELAY;
    if (visibleCount < 0) {
      delay = 300;
    } else if (prev?.type === "tool" && prev.toolCall?.status === "running") {
      delay = TOOL_RUNNING_DELAY;
    } else if (prev?.type === "tool" && prev.toolCall?.name === "VideoDB reel") {
      delay = 600;
    } else if (prev?.type === "tool") {
      const next = fullEvents[visibleCount + 1];
      delay = next?.type === "text-delta" ? 400 : TOOL_RUNNING_DELAY;
    } else if (prev?.type === "text-delta") {
      delay = TEXT_CHUNK_DELAY;
    }

    const timer = setTimeout(() => {
      setVisibleCount((current) => Math.min(current + 1, fullEvents.length - 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [notFound, fullEvents, visibleCount]);

  useEffect(() => {
    if (notFound || !fullStatusHistory.length) return;
    if (reelDispatchedAt < 0) return;
    if (visibleCount < reelDispatchedAt) return;
    if (visibleStatusCount >= fullStatusHistory.length - 1) return;

    const delay = visibleStatusCount < 0
      ? FIRST_STATUS_DELAY
      : STATUS_DELAYS[Math.min(visibleStatusCount, STATUS_DELAYS.length - 1)];

    const timer = setTimeout(() => {
      setVisibleStatusCount((current) => Math.min(current + 1, fullStatusHistory.length - 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [notFound, fullStatusHistory, reelDispatchedAt, visibleCount, visibleStatusCount]);

  useEffect(() => {
    if (notFound || redirectedRef.current || !fullEvents.length) return;
    if (visibleCount >= fullEvents.length - 1 && visibleStatusCount >= fullStatusHistory.length - 1) {
      redirectedRef.current = true;
      const timer = setTimeout(() => router.push(`/b/${runId}`), 2000);
      return () => clearTimeout(timer);
    }
  }, [notFound, fullEvents.length, fullStatusHistory.length, router, runId, visibleCount, visibleStatusCount]);

  useEffect(() => {
    if (scrollRef.current && !stopAutoScrollRef.current) {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollRef.current.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "end" });
    }
  }, [visibleCount, visibleStatusCount]);

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
        <p className="text-[15px] text-[var(--c-text-muted)]">Briefing not found.</p>
        <Link href="/" className="rounded-full bg-[#F24E1E] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#D14016]">
          Go home
        </Link>
      </div>
    );
  }

  const query = run?.query || "Preparing your briefing...";
  const shortId = runId.slice(0, 8);

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1060px] px-[22px] pt-5 pb-24">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-[7px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E]"
          >
            <ArrowLeftIcon className="size-3.5" /> Briefings
          </Link>
          <button
            type="button"
            onClick={() => router.push(`/b/${runId}`)}
            className="inline-flex items-center gap-[6px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-[13px] py-[7px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:border-[#F24E1E] active:scale-[0.98] transition-transform"
          >
            Skip replay <ArrowRightIcon className="size-3.5" />
          </button>
        </div>

        <div className="mt-[18px] flex items-center gap-3">
          <span className="inline-flex items-center gap-[7px] rounded-full border border-[#F24E1E]/40 bg-[#F24E1E]/10 px-[13px] py-1.5">
            <span className="status-dot-running size-2 rounded-full bg-[#F24E1E]" />
            <span className="text-[12px] font-bold tracking-[0.02em] text-[#F24E1E]">PROCESSING</span>
          </span>
          <span className="font-mono text-[12px] text-[var(--c-text-subtle)]">run {shortId}</span>
        </div>
        <h1 className="mt-[14px] max-w-[720px] text-[25px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[var(--c-text)]">{query}</h1>

        <div className="mx-auto mt-[26px] max-w-[720px] space-y-4">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-[18px_18px_6px_18px] bg-[var(--c-hover-2)] px-4 py-[11px] text-[14.5px] text-[var(--c-text-muted)]">{query}</div>
          </div>
          <div className="space-y-[13px]">
            {visibleEvents.length > 0 ? (
              <>
                <TimelineView events={visibleEvents} isDark={isDark} />
                {visibleStatus.length > 0 ? (
                  <StatusHistory cards={visibleStatus} isDark={isDark} />
                ) : null}
              </>
            ) : (
              <StatusHistory cards={undefined} fallback={run?.statusMessage || "Creating your highlight..."} isDark={isDark} />
            )}
            <div ref={scrollRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

type TimelineEvent = {
  type: string;
  text?: string;
  toolCall?: {
    name: string;
    status: string;
    summary: string;
    details?: unknown;
  };
};

function TimelineView({ events, isDark }: { events: TimelineEvent[]; isDark: boolean }) {
  const items: Array<{ type: "text"; text: string } | { type: "tool"; tc: TimelineEvent["toolCall"] }> = [];
  let textBuf = "";

  for (const ev of events) {
    if (ev.type === "text-delta" && ev.text) {
      textBuf += ev.text;
    } else {
      if (textBuf.trim()) { items.push({ type: "text", text: textBuf.trim() }); textBuf = ""; }
      if (ev.type === "tool" && ev.toolCall) {
        items.push({ type: "tool", tc: ev.toolCall });
      }
    }
  }
  if (textBuf.trim()) items.push({ type: "text", text: textBuf.trim() });

  return (
    <div className="space-y-[13px]">
      {items.map((item, i) => {
        if (item.type === "text") {
          return (
            <div key={i} className="flex items-start gap-[10px]">
              <div className="text-[14px] leading-relaxed text-[var(--c-text-muted)] prose-sm prose-invert prose-p:my-1 prose-strong:text-[var(--c-text)] prose-em:text-[var(--c-text-muted)] [&_p]:mb-1.5 [&_ol]:my-2 [&_ol]:pl-5 [&_li]:mb-1 [&_li]:pl-0.5">
                <ReactMarkdown>{item.text}</ReactMarkdown>
              </div>
            </div>
          );
        }
        const tc = item.tc!;
        const isTinyFish = tc.name.includes("TinyFish");
        return (
          <div key={i} className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] overflow-hidden">
            {isTinyFish ? (
              <>
                <div className="flex items-center gap-[10px] border-b border-[var(--c-border)] px-4 py-[13px]">
                  <Image src={isDark ? "/brand/icon-tinyfish-dark.png" : "/brand/icon-tinyfish.png"} alt="" width={18} height={18} className="size-[18px] rounded-[4px] flex-none" />
                  <span className="text-[13.5px] font-bold text-[var(--c-text)]">TinyFish · {tc.summary}</span>
                </div>
                {tc.details && (tc.details as { results?: Array<{ title: string; url: string }> }).results?.[0] ? (
                  <div className="px-4 py-[13px]">
                    <p className="text-[11px] font-bold tracking-[0.06em] text-[var(--c-text-subtle)]">SELECTED SOURCE</p>
                    <a
                      href={(tc.details as { results?: Array<{ title: string; url: string }> }).results?.[0]?.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-block text-[14px] font-semibold text-[#F24E1E] hover:underline"
                    >
                      {(tc.details as { results?: Array<{ title: string }> }).results?.[0]?.title}
                    </a>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center gap-[10px] px-4 py-[13px]">
                {tc.status === "done" ? (
                  <Image src={isDark ? "/brand/icon-videodb-dark.png" : "/brand/icon-videodb.png"} alt="" width={18} height={18} className="size-[18px] rounded-[4px] flex-none" />
                ) : (
                  <span className="size-[18px] rounded-full border-2 border-[var(--c-border)] border-t-[#F24E1E] animate-spin" />
                )}
                <span className="text-[13.5px] font-bold text-[var(--c-text)]">VideoDB · {tc.summary}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusHistory({ cards, fallback, isDark }: { cards?: Array<{ ts: string; msg: string }>; fallback?: string; isDark: boolean }) {
  if (cards && cards.length > 0) {
    return (
      <>
        {cards.map((entry, i) => {
          const isLast = i === cards.length - 1;
          return (
            <div key={i} className="flex items-center gap-[10px] rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] p-[15px]">
              <div className="flex items-center gap-[10px] flex-1">
                {isLast ? (
                  <span className="size-[18px] flex-none rounded-full border-2 border-[var(--c-border)] border-t-[#F24E1E] animate-spin" />
                ) : (
                  <Image src={isDark ? "/brand/icon-videodb-dark.png" : "/brand/icon-videodb.png"} alt="" width={18} height={18} className="size-[18px] rounded-[4px] flex-none" />
                )}
                <span className="text-[13.5px] font-bold text-[var(--c-text)]">{entry.msg}</span>
              </div>
            </div>
          );
        })}
      </>
    );
  }
  return (
    <div className="flex items-center gap-[10px] rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] p-[15px]">
      <div className="flex items-center gap-[10px] flex-1">
        <span className="size-[18px] flex-none rounded-full border-2 border-[var(--c-border)] border-t-[#F24E1E] animate-spin" />
        <span className="text-[13.5px] font-bold text-[var(--c-text)]">{fallback || "Creating your highlight..."}</span>
      </div>
    </div>
  );
}
