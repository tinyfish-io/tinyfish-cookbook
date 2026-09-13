"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GalleryRun } from "@/app/gallery/page";
import ConfirmModal from "@/components/ConfirmModal";
import { Pagination } from "@/components/Pagination";
import { ArrowLeftIcon } from "@/components/Icons";
import StatusBadge from "@/components/StatusBadge";
import { formatHourMinute, relativeTimeUntil } from "@/lib/time";

type ScheduleDetail = {
  id: string;
  query: string;
  runTime: string;
  timezone: string;
  channel: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string | null;
};

type RunItem = {
  id: string;
  query: string;
  topic: string | null;
  status: string;
  player_url: string | null;
  thumbnail_url: string | null;
  events: GalleryRun["events"];
  summary: string | null;
  selected_video: GalleryRun["selectedVideo"];
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
};

export default function ScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    async function load() {
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) { setError("Add your API keys to view schedule details."); setLoading(false); return; }
      try {
        const url = new URL(`/api/schedules/${id}`, window.location.origin);
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", "15");
        const res = await fetch(url.toString(), { headers: { "x-session-token": sessionToken } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load schedule");
        setSchedule(data.schedule);
        setRuns(data.runs || []);
        setTotalPages(data.totalPages || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally { setLoading(false); }
    }
    load();
  }, [id, page]);

  async function toggleActive() {
    if (!schedule) return;
    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) return;
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
        body: JSON.stringify({ isActive: !schedule.isActive }),
      });
      if (res.ok) setSchedule((prev) => prev ? { ...prev, isActive: !prev.isActive } : prev);
    } catch {}
    setConfirmToggle(false);
  }

  async function handleDelete() {
    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) return;
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "DELETE",
        headers: { "x-session-token": sessionToken },
      });
      if (res.ok) router.push("/schedules");
    } catch {}
  }

  function handleEdit() {
    if (!schedule) return;
    localStorage.setItem("editing_schedule", JSON.stringify(schedule));
    router.push("/schedules");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--c-bg)]">
        <svg viewBox="0 0 16 16" className="size-5 shrink-0 animate-spin text-[#F24E1E]" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-[var(--c-bg)] text-[var(--c-text)]">
        <div className="mx-auto max-w-[1000px] px-[22px] pt-5 pb-24">
          <Link href="/schedules" className="ds-btn ds-btn--ghost-dark ds-btn--sm">
            <ArrowLeftIcon className="size-3.5" /> Schedules
          </Link>
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-[15px] text-[var(--c-text-subtle)]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[var(--c-bg)] text-[var(--c-text)]">
      <div className="mx-auto max-w-[1000px] px-[22px] pt-5 pb-24">
        <div className="flex items-center justify-between gap-3">
          <Link href="/schedules" className="ds-btn ds-btn--ghost-dark ds-btn--sm">
            <ArrowLeftIcon className="size-3.5" /> Schedules
          </Link>
          {schedule ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleEdit} className="ds-btn ds-btn--ghost-dark ds-btn--sm">Edit</button>
              <button type="button" onClick={() => setDeleteConfirm(true)} className="rounded-[10px] border border-[var(--c-border)] bg-transparent px-[14px] py-2 text-[12.5px] font-semibold text-[#E5484D] transition-colors hover:border-[#E5484D]/40">Delete</button>
            </div>
          ) : null}
        </div>

        <div className="mt-[18px] flex items-start justify-between gap-4 flex-wrap ds-card ds-card--dark p-6">
          <div className="min-w-[240px]">
            <h1 className="text-[21px] font-extrabold leading-[1.3] tracking-[-0.015em] text-[var(--c-text)]">{schedule?.query}</h1>
            <p className="mt-2 text-[14px] text-[var(--c-text-muted)]">Daily at {schedule ? formatHourMinute(schedule.runTime) : ""} ({schedule?.timezone})</p>
            <p className="mt-1 text-[13.5px] text-[var(--c-text-subtle)]">
              via {schedule?.channel?.split(",").map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)).join(" & ")}
              {schedule?.nextRunAt ? ` · next run ${relativeTimeUntil(schedule.nextRunAt)}` : ""}
            </p>
          </div>
          {schedule ? (
            <button
              type="button"
              onClick={() => setConfirmToggle(true)}
              className={schedule.isActive ? "ds-pill-status ds-pill-status--orange" : "ds-pill-status ds-pill-status--muted-dark"}
            >
              {schedule.isActive ? <><span className="size-2 rounded-full bg-current" />Active</> : "Paused"}
            </button>
          ) : null}
        </div>

        <h2 className="mb-3 mt-7 text-[14px] font-bold text-[var(--c-text-muted)]">Run history</h2>
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-[15px] text-[var(--c-text-subtle)]">No runs yet</p>
            <p className="mt-1 text-[13px] text-[var(--c-text-subtle)]">Runs will appear here when the schedule executes.</p>
          </div>
        ) : (
          <div className="grid gap-[18px] min-w-0 ds-briefing-grid">
            {runs.map((run) => {
              const title = run.topic || run.query;
              const eventCount = Array.isArray(run.events) ? run.events.length : 0;
              const momentsText = eventCount ? `${eventCount} moments` : "";
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); router.push(`/b/${run.id}`); }}
                  aria-label={title ? `Open briefing: ${title}` : "Open briefing"}
                  className="ds-card ds-card--dark is-interactive group block w-full text-left overflow-hidden"
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {run.thumbnail_url ? (
                      <img src={run.thumbnail_url} alt={title ?? ""} className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#2d5a1e] via-[#3a7a2a] to-[#2d5a1e]">
                        <span className="relative z-10 text-center text-[13px] font-semibold text-[var(--c-text-muted)] max-w-[80%] truncate px-3">{title}</span>
                      </div>
                    )}
                    {run.status === "completed" ? (
                      <>
                        <span className="absolute top-[10px] left-[10px]"><StatusBadge status="completed" /></span>
                      </>
                    ) : run.status === "processing" ? (
                      <span className="absolute top-[10px] left-[10px]"><StatusBadge status="processing" /></span>
                    ) : (
                      <span className="absolute top-[10px] left-[10px]"><StatusBadge status="failed" /></span>
                    )}
                  </div>
                  <div className="px-[15px] pt-[13px] pb-[15px]">
                    <p className="text-[14.5px] font-bold text-[var(--c-text)] line-clamp-1">{title}</p>
                    <div className="mt-[9px] flex items-center gap-2 text-[12px] text-[var(--c-text-subtle)]">
                      {momentsText ? <span>{momentsText}</span> : null}
                      {momentsText ? <span className="size-[3px] rounded-full bg-[var(--c-text-faint)]" /> : null}
                      <span>{relativeTimeUntil(run.created_at || "")}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <ConfirmModal open={confirmToggle} title={schedule?.isActive ? "Pause this schedule?" : "Resume this schedule?"} confirmLabel={schedule?.isActive ? "Pause" : "Resume"} onConfirm={toggleActive} onClose={() => setConfirmToggle(false)}>
        {schedule ? <><p>This will {schedule.isActive ? "pause" : "resume"} daily briefings for:</p><p className="mt-2 rounded-[10px] bg-[#f4f2ec] px-3 py-2.5 text-[14px] font-semibold text-[#1f1f1e]">&ldquo;{schedule.query}&rdquo;</p></> : null}
      </ConfirmModal>

      <ConfirmModal open={deleteConfirm} title="Delete schedule?" confirmLabel="Delete" danger onConfirm={handleDelete} onClose={() => setDeleteConfirm(false)}>
        <p>This will permanently remove the schedule. Past runs are not affected.</p>
      </ConfirmModal>
    </div>
  );
}
