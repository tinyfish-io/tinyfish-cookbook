"use client";

import { useCallback, useRef, useState } from "react";

export type SourceState = {
  key: string;
  label: string;
  family: string;
  status: "queued" | "working" | "complete" | "failed";
  purpose?: string;
  streamingUrl?: string;
  durationMs?: number;
  itemsRead?: number;
  note?: string | null;
  error?: string;
  samples?: { quote: string; source_label: string; published_at: string | null }[];
};

export type ScanState = {
  phase: "idle" | "running" | "complete" | "error";
  scanId?: number;
  company?: { id: number; ticker: string; name: string };
  sources: SourceState[];
  score: number | null;
  provisional: boolean;
  families: Record<string, { score: number; weight: number }>;
  startedAt?: number;
  error?: string;
};

const IDLE: ScanState = { phase: "idle", sources: [], score: null, provisional: true, families: {} };

export function useScan() {
  const [state, setState] = useState<ScanState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (ticker: string) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setState({ ...IDLE, phase: "running", startedAt: Date.now() });

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
        signal: abort.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        setState((s) => ({ ...s, phase: "error", error: body.error ?? `HTTP ${response.status}` }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          setState((s) => applyEvent(s, event));
        }
      }
      setState((s) => (s.phase === "running" ? { ...s, phase: "complete" } : s));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({ ...s, phase: "error", error: (err as Error).message }));
    }
  }, []);

  return { state, start };
}

function applyEvent(s: ScanState, e: Record<string, unknown>): ScanState {
  switch (e.type) {
    case "scan_created":
      return {
        ...s,
        scanId: Number(e.scanId),
        company: e.company as ScanState["company"],
        sources: (e.sources as { key: string; label: string; family: string }[]).map((src) => ({
          ...src,
          status: "queued" as const,
        })),
      };
    case "source_started":
      return patch(s, e.key as string, { status: "working" });
    case "source_progress":
      return patch(s, e.key as string, { purpose: e.purpose as string });
    case "source_streaming":
      return patch(s, e.key as string, { streamingUrl: e.streamingUrl as string });
    case "source_complete":
      return patch(s, e.key as string, {
        status: e.ok ? "complete" : "failed",
        durationMs: e.durationMs as number,
        itemsRead: e.itemsRead as number,
        note: e.note as string | null,
        error: e.error as string | undefined,
        samples: e.samples as SourceState["samples"],
      });
    case "score_updated":
      return {
        ...s,
        score: e.score as number | null,
        provisional: e.provisional as boolean,
        families: e.families as ScanState["families"],
      };
    case "scan_complete":
      return { ...s, phase: "complete", score: e.score as number | null };
    case "scan_error":
      return { ...s, phase: "error", error: e.message as string };
    default:
      return s;
  }
}

function patch(s: ScanState, key: string, changes: Partial<SourceState>): ScanState {
  return { ...s, sources: s.sources.map((src) => (src.key === key ? { ...src, ...changes } : src)) };
}
