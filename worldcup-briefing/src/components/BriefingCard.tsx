"use client";
/* eslint-disable @next/next/no-img-element */

import React from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import FallbackThumbnail from "@/components/FallbackThumbnail";
import { relativeTimeAgo } from "@/lib/time";

type BriefingCardRun = {
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

export default function BriefingCard({ run }: { run: BriefingCardRun }) {
  const router = useRouter();
  const title = run.topic || run.query || "Untitled briefing";
  const subtitle = run.summary || run.query || "";
  const eventCount = Array.isArray(run.events) ? run.events.length : 0;
  const momentsText = eventCount ? `${eventCount} moments` : "";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        router.push(`/b/${run.id}`);
      }}
      aria-label={`Open briefing: ${title}`}
      className="group block w-full text-left rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-[180ms] hover:border-[#F24E1E] hover:shadow-[0_10px_26px_rgba(242,78,30,0.16)] overflow-hidden hover-lift"
    >
      <div className="relative aspect-video bg-black overflow-hidden">
        {run.thumbnail_url ? (
          <img
            src={run.thumbnail_url}
            alt={title}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
          />
        ) : (
          <FallbackThumbnail label={title} />
        )}
        <div className="absolute top-[10px] left-[10px]">
          <StatusBadge status={run.status} />
        </div>
      </div>
      <div className="px-[15px] pt-[13px] pb-[15px]">
        <p title={title} className="text-[14.5px] font-bold text-[var(--c-text)] line-clamp-1">{title}</p>
        <p className="mt-[5px] text-[13px] text-[var(--c-text-muted)] line-clamp-2 leading-[1.5]">{subtitle}</p>
        <div className="mt-[11px] flex items-center gap-2 text-[12px] text-[var(--c-text-subtle)]">
          {momentsText ? <span>{momentsText}</span> : null}
          {momentsText ? <span className="size-[3px] rounded-full bg-[var(--c-text-faint)]" /> : null}
          <span>{relativeTimeAgo(run.created_at)}</span>
        </div>
      </div>
    </button>
  );
}
