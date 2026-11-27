"use client";

import { useSyncExternalStore } from "react";
import type { Paper, Term } from "./types";

// Per-reader state lives in the browser: no accounts needed to bookmark, resume or save.
// Wrapped so private windows / blocked storage degrade to in-memory without crashing.

export interface Progress {
  chapter: number; // 1-based
  page: number; // 1-based within chapter
  totalChapters: number;
  updatedAt: string;
}
export interface SavedConcept extends Term {
  paperId: string;
  paperTitle: string;
  savedAt: string;
}
export interface LibraryState {
  bookmarks: Record<string, { paper: Paper; savedAt: string }>;
  progress: Record<string, Progress & { title: string }>;
  concepts: SavedConcept[];
  quiz: Record<string, { score: number; total: number; at: string }>;
}

const KEY = "kensho.library.v1";
const EMPTY: LibraryState = { bookmarks: {}, progress: {}, concepts: [], quiz: {} };
let memory: LibraryState = EMPTY;
let cached: LibraryState | null = null;
const listeners = new Set<() => void>();

function read(): LibraryState {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? { ...EMPTY, ...JSON.parse(raw) } : memory;
  } catch {
    cached = memory;
  }
  return cached!;
}

function write(next: LibraryState) {
  cached = next;
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep in memory */
  }
  listeners.forEach((l) => l());
}

export function useLibrary(): LibraryState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          cached = null;
          cb();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => EMPTY,
  );
}

export const library = {
  toggleBookmark(paper: Paper) {
    const s = read();
    const bookmarks = { ...s.bookmarks };
    if (bookmarks[paper.id]) delete bookmarks[paper.id];
    else bookmarks[paper.id] = { paper, savedAt: new Date().toISOString() };
    write({ ...s, bookmarks });
  },
  setProgress(paperId: string, title: string, p: Omit<Progress, "updatedAt">) {
    const s = read();
    const prev = s.progress[paperId];
    if (prev && prev.chapter === p.chapter && prev.page === p.page) return;
    write({ ...s, progress: { ...s.progress, [paperId]: { ...p, title, updatedAt: new Date().toISOString() } } });
  },
  toggleConcept(c: Omit<SavedConcept, "savedAt">) {
    const s = read();
    const exists = s.concepts.some((x) => x.paperId === c.paperId && x.term.toLowerCase() === c.term.toLowerCase());
    write({
      ...s,
      concepts: exists
        ? s.concepts.filter((x) => !(x.paperId === c.paperId && x.term.toLowerCase() === c.term.toLowerCase()))
        : [{ ...c, savedAt: new Date().toISOString() }, ...s.concepts],
    });
  },
  saveQuiz(paperId: string, score: number, total: number) {
    const s = read();
    write({ ...s, quiz: { ...s.quiz, [paperId]: { score, total, at: new Date().toISOString() } } });
  },
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}
