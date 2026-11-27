import { sitesFor } from "./sites/index.ts";
import type { CountrySites, Site } from "./types.ts";

export const EXAMPLES_SHOWN = 3;

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  return items
    .map((item) => ({ item, order: random() }))
    .toSorted((a, b) => a.order - b.order)
    .map(({ item }) => item);
}

interface ExampleKind {
  words: (market: CountrySites) => string;
  /** Set once this kind has run as a guest on the live site and given a useful report. */
  proven: boolean;
}

const firstName = (sites: readonly Site[] | undefined) => sites?.[0]?.name ?? "";

const KINDS: readonly ExampleKind[] = [
  { words: () => "Sign up for Adobe Creative Cloud", proven: true },
  {
    words: (market) => `Order dinner on ${firstName(market.categories.food_delivery)}`,
    proven: true,
  },
  {
    words: (market) => `Buy concert tickets on ${firstName(market.categories.movies_events)}`,
    proven: false,
  },
  {
    words: (market) => `Buy a laptop on ${firstName(market.categories.electronics)}`,
    proven: true,
  },
  {
    words: (market) => `Choose a mobile plan on ${firstName(market.categories.telecom)}`,
    proven: false,
  },
];

function localExamples(country: string): string[] | null {
  const market = sitesFor(country);
  if (!market) return null;
  return KINDS.filter(({ proven }) => proven).map(({ words }) => words(market));
}

const WORLDWIDE_EXAMPLES = [
  "Sign up for Adobe Creative Cloud",
  "Buy a laptop on Amazon",
  "Order dinner on Uber Eats",
] as const;

export function examplesFor(country: string | null, random: () => number = Math.random): string[] {
  const all = (country && localExamples(country)) || WORLDWIDE_EXAMPLES;
  return shuffled(all, random).slice(0, EXAMPLES_SHOWN);
}
