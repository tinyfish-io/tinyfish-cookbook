"use client";
/* eslint-disable @next/next/no-img-element */

import React from "react";
import { useRouter } from "next/navigation";
import type { GalleryRun } from "../page";
import StatusBadge from "@/components/StatusBadge";
import FallbackThumbnail from "@/components/FallbackThumbnail";
import { relativeTimeAgo } from "@/lib/time";

export default function GalleryGrid({ runs }: { runs: GalleryRun[] }) {
  const router = useRouter();

  if (!runs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[15px] text-[var(--c-text-muted)]">No briefings found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-[18px] min-w-0 ds-briefing-grid">
      {runs.map((run) => {
        const title = run.topic || run.query;
        const eventCount = Array.isArray(run.events) ? run.events.length : 0;
        const momentsText = eventCount ? `${eventCount} moments` : "";
        return (
          <button
            key={run.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              router.push(`/b/${run.id}`);
            }}
            aria-label={title ? `Open briefing: ${title}` : "Open briefing"}
            className="group block w-full text-left rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-[180ms] hover:border-[#F24E1E] hover:shadow-[0_10px_26px_rgba(242,78,30,0.18)] overflow-hidden hover-lift"
          >
            <div className="relative aspect-video bg-[var(--c-bg)] overflow-hidden">
              {run.thumbnailUrl ? (
                <img
                  src={run.thumbnailUrl}
                  alt={title ?? ""}
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <FallbackThumbnail label={title ?? ""} />
              )}
              {!run.status || run.status === "completed" ? (
                <span className="absolute top-[10px] left-[10px]"><StatusBadge status="completed" /></span>
              ) : run.status === "processing" ? (
                <span className="absolute top-[10px] left-[10px]"><StatusBadge status="processing" /></span>
              ) : (
                <span className="absolute top-[10px] left-[10px]"><StatusBadge status="failed" /></span>
              )}
            </div>
            <div className="px-[15px] pt-[13px] pb-[15px]">
              <p className="text-[14.5px] font-bold text-[var(--c-text)] line-clamp-1">{title}</p>
              <p className="mt-[5px] text-[13px] text-[var(--c-text-subtle)] line-clamp-2 leading-[1.4]">{run.query}</p>
              <div className="mt-[11px] flex items-center gap-2 text-[12px] text-[var(--c-text-subtle)]">
                {momentsText ? <span>{momentsText}</span> : null}
                {momentsText ? <span className="size-[3px] rounded-full bg-[var(--c-text-faint)]" /> : null}
                <span>{relativeTimeAgo(run.createdAt)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
