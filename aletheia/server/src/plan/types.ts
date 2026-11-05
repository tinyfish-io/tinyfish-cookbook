import type { Flow } from "../judge/types.ts";

/** Categories with their own main sites in each country. */
export type NationalCategory =
  | "food_delivery"
  | "electronics"
  | "fashion"
  | "general"
  | "travel"
  | "movies_events"
  | "telecom"
  | "home";

/** Categories served by the same brands almost everywhere. */
export type GlobalCategory =
  | "subscriptions"
  | "streaming"
  | "music"
  | "software"
  | "security"
  | "cloud"
  | "dating"
  | "fitness"
  | "gaming"
  | "learning"
  | "news";

export type Category = NationalCategory | GlobalCategory;

export interface Site {
  name: string;
  url: string;
}

export interface Brand extends Site {
  /** Words that name this brand or one of its products, in lower case. */
  aliases: readonly string[];
  /** The brand sells plans, so naming it means a sign-up even with no word such as "plan". */
  subscription?: boolean;
  /** The brand's own site in a country, where it has one. */
  urls?: Readonly<Partial<Record<string, string>>>;
}

export interface CountrySites {
  /** What the agent types when a site asks where to deliver and the visitor's city is unknown. */
  location: string;
  categories: Record<NationalCategory, readonly Site[]> &
    Partial<Record<GlobalCategory, readonly Site[]>>;
  brands: readonly Brand[];
}

export interface PlannedSite extends Site {
  host: string;
}

export type PlanSource = "named" | "category" | "search" | "fallback" | "question" | "none";

export interface PlanQuestion {
  text: string;
  suggestions: PlannedSite[];
}

export interface AuditPlan {
  flow: Flow;
  country: string | null;
  countryName: string;
  /** False when TinyFish cannot browse from this country, so prices may differ. */
  proxied: boolean;
  category: Category | null;
  source: PlanSource;
  sites: PlannedSite[];
  /** Set when no site could be picked, so the visitor always has a way on. */
  question: PlanQuestion | null;
}
