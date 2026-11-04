/**
 * Client-side persistence for the user's preferences and last run. Everything lives in this
 * browser's localStorage — no accounts. All access is guarded: storage can be blocked or empty
 * (private windows, cleared data), and the app must still work without it.
 */
import { useMemo, useSyncExternalStore } from "react";
import type { PipelineResult } from "./pipeline";
import type { RunRequest } from "./run";
import type { SeenMap } from "./freshness";

export type StoredPrefs = Required<Omit<RunRequest, "agentRuns" | "passcode">> & { deepSearch: boolean };

const PREFS_KEY = "openings:prefs:v1";
const LAST_RUN_KEY = "openings:last-run:v1";
const SEEN_KEY = "openings:seen:v1";
const PASSCODE_KEY = "openings:passcode:v1";

export const DEFAULT_PREFS: StoredPrefs = {
  role: "software engineer",
  seniority: "internship",
  locations: [],
  gradYear: null,
  needsVisa: false,
  keywords: [],
  companies: [],
  deepSearch: false,
};

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — the current session still works.
  }
}

function parsePrefs(p: Partial<StoredPrefs> | null): StoredPrefs | null {
  return p?.role ? { ...DEFAULT_PREFS, ...p } : null;
}

export function loadPrefs(): StoredPrefs | null {
  return parsePrefs(read<Partial<StoredPrefs>>(PREFS_KEY));
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

/** A JSON value in localStorage as React state: `undefined` before hydration, then the value or `null`. */
function useStored<T>(key: string, parse: (v: unknown) => T | null): T | null | undefined {
  const raw = useSyncExternalStore(
    subscribeStorage,
    () => readRaw(key) ?? "",
    () => undefined,
  );
  return useMemo(() => {
    if (raw === undefined) return undefined;
    try {
      return raw ? parse(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }, [raw, parse]);
}

/**
 * Saved preferences: `undefined` while server-rendering / before hydration (storage isn't readable
 * there), then the saved prefs or `null`.
 */
export function useSavedPrefs(): StoredPrefs | null | undefined {
  return useStored(PREFS_KEY, parsePrefs as (v: unknown) => StoredPrefs | null);
}

const parseLastRun = (v: unknown) => ((v as LastRun | null)?.result?.jobs ? (v as LastRun) : null);

/** The last finished scan saved in this browser. */
export function useLastRun(): LastRun | null | undefined {
  return useStored(LAST_RUN_KEY, parseLastRun);
}

export function savePrefs(prefs: StoredPrefs) {
  write(PREFS_KEY, prefs);
}

export interface LastRun {
  at: string; // ISO time the run finished
  prefs: StoredPrefs;
  result: PipelineResult;
  newIds?: string[]; // jobs not seen in any earlier scan (absent on scans saved before Phase 5)
  previousAt?: string | null; // when the scan before this one finished
}

/** When this browser first saw each job (see freshness.ts). */
export function loadSeen(): SeenMap {
  return read<SeenMap>(SEEN_KEY) ?? {};
}

export function saveSeen(seen: SeenMap) {
  write(SEEN_KEY, seen);
}

/** Deep-search passcode for the public deploy, remembered in this browser once entered. */
export function loadPasscode(): string | null {
  return read<string>(PASSCODE_KEY);
}

export function savePasscode(passcode: string) {
  write(PASSCODE_KEY, passcode);
}

export function loadLastRun(): LastRun | null {
  return read<LastRun>(LAST_RUN_KEY);
}

export function saveLastRun(run: LastRun) {
  write(LAST_RUN_KEY, run);
}

/** "Software engineer internships · New York, Remote · Class of 2027 · needs visa" */
export function describePrefs(p: StoredPrefs): string {
  const level = { internship: "internships", new_grad: "new-grad roles", any: "roles" }[p.seniority];
  const role = p.role.charAt(0).toUpperCase() + p.role.slice(1);
  return [
    `${role} ${level}`,
    p.locations.length ? p.locations.join(", ") : "anywhere",
    p.gradYear ? `class of ${p.gradYear}` : null,
    p.needsVisa ? "needs visa sponsorship" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Body for POST /api/run. Deep search = allow 2 metered Agent runs. */
export function toRunRequest(p: StoredPrefs): RunRequest {
  const { deepSearch, ...rest } = p;
  return { ...rest, agentRuns: deepSearch ? 2 : 0 };
}
