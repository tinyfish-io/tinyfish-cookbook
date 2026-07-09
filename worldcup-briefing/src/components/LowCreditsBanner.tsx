"use client";

import { useEffect, useState } from "react";
import { CloseIcon, ExternalLinkIcon } from "@/components/Icons";

const DISMISS_KEY = "low_credits_dismissed";

export default function LowCreditsBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const token = localStorage.getItem("session_token");
    if (!token) return;

    fetch("/api/credits", { headers: { "x-session-token": token } })
      .then((r) => r.json())
      .then((d: { remaining: number | null; low: boolean }) => {
        if (d.low) setVisible(true);
      })
      .catch(() => {});
  }, []);

  if (!visible) return null;

  return (
    <div role="alert" className="mb-5">
      <div className="flex items-center gap-3 rounded-[14px] border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.06)] px-5 py-3.5">
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="flex-1 text-[13.5px] leading-snug text-[var(--c-text-muted)]">
          Your VideoDB credits are low —{" "}
          <a
            href="https://console.videodb.io"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#F59E0B] hover:underline"
          >
            top up to keep your reels running{" "}
            <ExternalLinkIcon className="size-3 shrink-0" />
          </a>
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--c-text-faint)] transition-colors hover:bg-[rgba(245,158,11,0.15)] hover:text-[#F59E0B]"
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
