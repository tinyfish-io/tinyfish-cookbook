"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ModalShell from "@/components/ModalShell";
import ChannelIcon from "@/components/ChannelIcon";
import { CloseIcon, CheckIcon } from "@/components/Icons";

type Inbox = {
  id: string;
  name: string;
  type: string;
  isValidated: boolean;
};

type SendResult = {
  name: string;
  type: string;
  success: boolean;
  error?: string;
};

type Props = {
  runId: string;
  open: boolean;
  onClose: () => void;
};

export default function SendToInboxModal({ runId, open, onClose }: Props) {
  const router = useRouter();
  const [inboxes, setInboxes] = useState<Inbox[] | null>(null);
  const [loadingInboxes, setLoadingInboxes] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Record<string, SendResult> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    (async () => {
      setLoadingInboxes(true);
      setSelected(new Set());
      setResults(null);
      setError("");
      try {
        const sessionToken = localStorage.getItem("session_token");
        if (!sessionToken) { setInboxes([]); setLoadingInboxes(false); return; }
        const res = await fetch("/api/channels", {
          headers: { "x-session-token": sessionToken },
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Failed to load inboxes");
        const data = await res.json();
        setInboxes((data.channels || []) as Inbox[]);
      } catch {
        if (!ac.signal.aborted) setError("Could not load your inboxes.");
      } finally {
        if (!ac.signal.aborted) setLoadingInboxes(false);
      }
    })();
    return () => ac.abort();
  }, [open]);

  function toggle(id: string) {
    if (sending || results) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setError("");
    try {
      const sessionToken = localStorage.getItem("session_token");
      const res = await fetch("/api/send-to-inbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken || "",
        },
        body: JSON.stringify({ runId, channelIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Delivery failed");
        return;
      }
      setResults(data.results || {});
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const hasResults = results !== null;
  const allSent = results && Object.values(results).every((r) => r.success);
  const anyFailed = results && Object.values(results).some((r) => !r.success);

  function renderContent() {
    if (loadingInboxes) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="status-dot-running size-5 rounded-full bg-[#F24E1E]" />
        </div>
      );
    }

    if (error && !inboxes) {
      return (
        <div role="alert" className="animate-rise rounded-[11px] border border-[#E5484D]/40 bg-[#E5484D]/10 px-[13px] py-[11px] text-[13px] text-[#E5484D]">
          {error}
        </div>
      );
    }

    if (inboxes && inboxes.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-[13px] text-[var(--c-text-muted)] mb-4">
            You don&apos;t have any inboxes connected yet. Add one to send reels.
          </p>
          <button
            type="button"
            onClick={() => { onClose(); router.push("/schedules"); }}
            className="ds-btn ds-btn--primary text-[13px]"
          >
            Add an inbox
          </button>
        </div>
      );
    }

    if (hasResults) {
      return (
        <div className="space-y-2">
          {Object.entries(results).map(([id, r]) => (
            <div
              key={id}
              className={`flex items-center gap-3 rounded-[11px] border px-[12px] py-[9px] text-[13px] ${
                r.success
                  ? "border-[#30A46C]/30 bg-[#30A46C]/8"
                  : "border-[#E5484D]/30 bg-[#E5484D]/8"
              }`}
            >
              <ChannelIcon type={r.type} size={16} />
              <span className="flex-1 font-semibold text-[var(--c-text)]">{r.name}</span>
              {r.success ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#30A46C]">
                  <CheckIcon className="size-3.5" /> Sent
                </span>
              ) : (
                <span className="text-[12px] font-medium text-[#E5484D]">{r.error || "Failed"}</span>
              )}
            </div>
          ))}
          {allSent ? (
            <p className="text-[13px] text-[var(--c-text-muted)] pt-2">Reel delivered to all selected inboxes.</p>
          ) : anyFailed ? (
            <p className="text-[13px] text-[var(--c-text-muted)] pt-2">Some deliveries failed. You can try again.</p>
          ) : null}
        </div>
      );
    }

    return (
      <>
        {error ? (
          <div role="alert" className="animate-rise mb-4 rounded-[11px] border border-[#E5484D]/40 bg-[#E5484D]/10 px-[13px] py-[11px] text-[13px] text-[#E5484D]">
            {error}
          </div>
        ) : null}
        <div className="space-y-1">
          {inboxes?.map((inbox) => {
            const checked = selected.has(inbox.id);
            return (
              <label
                key={inbox.id}
                className={`flex items-center gap-3 rounded-[11px] border px-[12px] py-[9px] cursor-pointer transition-colors ${
                  checked
                    ? "border-[#F24E1E]/40 bg-[#F24E1E]/8"
                    : "border-[var(--c-border)] hover:border-[var(--c-border-strong)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(inbox.id)}
                  disabled={sending}
                  className="sr-only"
                />
                <ChannelIcon type={inbox.type} size={16} />
                <span className="flex-1 text-[13px] font-semibold text-[var(--c-text)]">{inbox.name}</span>
                {checked ? (
                  <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-[#F24E1E]" aria-hidden="true">
                    <CheckIcon className="size-3 text-white" />
                  </span>
                ) : (
                  <span className="size-[18px] rounded-full border-2 border-[var(--c-border)]" aria-hidden="true" />
                )}
              </label>
            );
          })}
        </div>
      </>
    );
  }

  const showActions = !loadingInboxes && !hasResults && inboxes && inboxes.length > 0;

  return (
    <ModalShell
      labelledBy="send-to-inbox-title"
      onClose={onClose}
      closeOnBackdrop={!sending}
      className="animate-rise w-full max-w-[380px] rounded-t-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-6 pt-6 pb-6 shadow-[0_-1px_48px_rgba(0,0,0,0.5)] sm:rounded-[18px] sm:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_20px_48px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 id="send-to-inbox-title" className="text-[16px] font-semibold text-[var(--c-text)]">
          {hasResults ? (allSent ? "Sent!" : "Results") : "Send to inbox"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          aria-label="Close"
          className="flex size-[30px] shrink-0 items-center justify-center rounded-full border-0 bg-[var(--c-hover-2)] text-[var(--c-text-subtle)] hover:text-[var(--c-text-muted)] disabled:opacity-50"
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>

      {renderContent()}

      {showActions ? (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="ds-btn ds-btn--ghost-dark disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={selected.size === 0 || sending}
            className="ds-btn ds-btn--primary flex-1 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Sending..." : `Send to ${selected.size} inbox${selected.size !== 1 ? "es" : ""}`}
          </button>
        </div>
      ) : hasResults ? (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setResults(null); setSelected(new Set()); }}
            className="ds-btn ds-btn--ghost-dark"
          >
            Send again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ds-btn ds-btn--primary flex-1 active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      ) : null}
    </ModalShell>
  );
}
