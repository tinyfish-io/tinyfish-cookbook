"use client";

import { useCallback, useRef, useState } from "react";
import type { PipelineResult, Stage } from "./pipeline";
import type { AgentRunLog } from "./agent";
import type { RunEvent, RunRequest } from "./run";

export type StageState = { status: "pending" | "active" | "done"; message: string; at: number | null };

export interface LiveAgent {
  url: string;
  purpose: AgentRunLog["purpose"];
  streamingUrl: string | null;
  lastStep: string | null;
  log: AgentRunLog | null; // set when the run finishes
}

export type RunStatus = "idle" | "running" | "done" | "error";

/** Stages in the order a run moves through them. */
export const STAGE_ORDER: Stage[] = ["search", "boards", "agent", "fetch", "firecrawl", "extract", "rank"];

const emptyStages = (): Record<Stage, StageState> =>
  Object.fromEntries(STAGE_ORDER.map((s) => [s, { status: "pending", message: "", at: null }])) as Record<Stage, StageState>;

/**
 * Starts a run against /api/run and follows its NDJSON stream: stage-by-stage progress, Agent runs
 * (with their live browser URLs), then the result.
 */
export function useRun(onResult: (result: PipelineResult) => void) {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [stages, setStages] = useState(emptyStages);
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apply = useCallback(
    (e: RunEvent) => {
      if (e.type === "progress") {
        // Stages can overlap (search and board reads run in parallel), so each one is only ticked
        // off by its own "done" message.
        setStages((prev) => ({ ...prev, [e.stage]: { status: e.done ? "done" : "active", message: e.message, at: e.at } }));
      } else if (e.type === "agent") {
        const ev = e.event;
        setAgents((prev) => {
          if (ev.type === "started") return [...prev, { url: ev.url, purpose: ev.purpose, streamingUrl: null, lastStep: null, log: null }];
          return prev.map((a) =>
            a.url !== (ev.type === "done" ? ev.log.url : ev.url) || a.log
              ? a
              : ev.type === "live"
                ? { ...a, streamingUrl: ev.streamingUrl }
                : ev.type === "progress"
                  ? { ...a, lastStep: ev.message }
                  : { ...a, log: ev.log },
          );
        });
      } else if (e.type === "result") {
        setStages((prev) =>
          Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v.status === "active" ? { ...v, status: "done" } : v])) as Record<
            Stage,
            StageState
          >,
        );
        setStatus("done");
        onResult(e.result);
      } else if (e.type === "error") {
        setError(e.message);
        setStatus("error");
      }
    },
    [onResult],
  );

  const start = useCallback(
    async (req: RunRequest) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStatus("running");
      setStages(emptyStages());
      setAgents([]);
      setError(null);
      setErrorCode(null);
      setStartedAt(Date.now());
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          if (typeof body.code === "string") setErrorCode(body.code);
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let sawEnd = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const event = JSON.parse(line) as RunEvent;
            if (event.type === "result" || event.type === "error") sawEnd = true;
            apply(event);
          }
        }
        if (!sawEnd) throw new Error("The scan was cut off before it finished. Try again.");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
        setStatus("error");
      }
    },
    [apply],
  );

  return { status, stages, agents, error, errorCode, startedAt, start };
}
