"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MeasureLeadTime({ ticker }: { ticker: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "failed">("idle");
  const [reason, setReason] = useState<string | null>(null);

  async function measure() {
    setState("running");
    setReason(null);
    try {
      const response = await fetch("/api/lead-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await response.json();
      if (data.ok) {
        router.refresh();
      } else {
        setState("failed");
        setReason(data.reason ?? data.error ?? "Unknown failure");
      }
    } catch {
      setState("failed");
      setReason("The request didn't go through — try again.");
    }
  }

  return (
    <div className="max-w-[640px]">
      <button
        onClick={measure}
        disabled={state === "running"}
        className="border px-5 py-3 text-[13px] font-semibold"
        style={{
          borderColor: "var(--color-rust)",
          color: state === "running" ? "var(--color-muted)" : "var(--color-rust)",
          background: "transparent",
          cursor: state === "running" ? "default" : "pointer",
        }}
      >
        {state === "running" ? "Reading a year of archived snapshots…" : "Measure it now from primary sources"}
      </button>
      <div className="mt-2.5 text-xs leading-relaxed text-muted">
        Reconstructs review velocity from Internet Archive snapshots of the company&apos;s Trustpilot page (~1–2 minutes), detects a
        sustained turn, and pairs it with a real officer-change filing from EDGAR. If the history is flat or the filing doesn&apos;t
        exist, it says so — measured, not modeled.
      </div>
      {state === "failed" && reason && (
        <div className="mt-3.5 border p-3.5 text-[13px] leading-relaxed" style={{ borderColor: "var(--color-hairline)" }}>
          {reason}
        </div>
      )}
    </div>
  );
}
