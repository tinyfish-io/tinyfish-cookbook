import { COVERED_COUNTRIES, WORLDWIDE } from "../../../server/src/plan/country.ts";
import type { PlannedSite } from "./sites.ts";
import { MAX_SITES } from "./sites.ts";
import type { PlanView } from "./types.ts";

const CATEGORY_LABEL: Record<NonNullable<PlanView["category"]>, string> = {
  food_delivery: "food delivery",
  electronics: "electronics",
  fashion: "fashion",
  general: "shopping",
  travel: "travel",
  movies_events: "movies and events",
  telecom: "mobile and broadband",
  home: "furniture",
  subscriptions: "software and streaming",
  streaming: "streaming",
  music: "music",
  software: "software",
  security: "security",
  cloud: "cloud storage",
  dating: "dating",
  fitness: "fitness",
  gaming: "gaming",
  learning: "language learning",
  news: "news",
};

/** The browser's own idea of where it is, for when the server has no country header. */
export function browserPlace(): { timeZone: string; languages: string[] } {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: [...navigator.languages],
  };
}

export interface CountryChoice {
  code: string;
  name: string;
}

/** What a report offers for running an audit again from somewhere else. */
export function countryChoices(): CountryChoice[] {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const countries = COVERED_COUNTRIES.map((code) => ({ code, name: names.of(code) ?? code }));
  return [
    ...countries.toSorted((a, b) => a.name.localeCompare(b.name)),
    { code: WORLDWIDE, name: "Worldwide" },
  ];
}

export interface SiteEdits {
  removed: readonly string[];
  added: readonly PlannedSite[];
}

/** The picks and the visitor's edits are kept apart, so a new plan never undoes an edit. */
export function pickedSites(
  picks: readonly { url: string; host: string }[],
  { removed, added }: SiteEdits,
): PlannedSite[] {
  const kept = picks.filter(({ host }) => !removed.includes(host));
  const extra = added.filter(({ host }) => !kept.some((site) => site.host === host));
  return [...kept, ...extra].slice(0, MAX_SITES).map(({ url, host }) => ({ url, host }));
}

export function planNote({ source, category }: PlanView): string | null {
  switch (source) {
    case "named":
      return "Named in your task.";
    case "category":
      return category
        ? `The main ${CATEGORY_LABEL[category]} sites where you are.`
        : "The main shopping sites where you are.";
    case "search":
      return "Found by a web search.";
    case "fallback":
      return "Sites that sell in most countries.";
    case "question":
    case "none":
      return null;
  }
}
