import { isTravelTask } from "../audit/goals.ts";
import { isCategoryWord } from "./category.ts";
import { isTypoOf } from "./fuzzy.ts";
import type { Brand, Site } from "./types.ts";

const TLD =
  "com|net|org|co|io|app|shop|store|in|uk|us|ca|au|de|fr|jp|es|it|nl|pl|se|br|mx|tr|sa|ae|sg|my|id|th|vn|ph|kr|cn|ke|ng|za|ie|at|ch|be|dk|no|fi|pt|ar|cl|nz|tv|me";
const ADDRESS = new RegExp(
  `(?<![\\p{L}\\d@.-])(?:https?:\\/\\/)?(?:[a-z\\d-]+\\.)+(?:${TLD})(?:\\/[^\\s,]*)?(?![\\p{L}\\d-])`,
  "giu",
);

const NAMED_AFTER_WORD = /\b(on|at|from)\s+([A-Z][\w&'-]*(?:\s[A-Z][\w&'-]*)?)/;
const NAMED_LAST = /\b(?:on|from)\s+([a-z][\w-]*)\s*$/;
const NOT_A_SITE =
  /^(sale|offer|discount|credit|debit|emi|cod|time|demand|delivery|amazon|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekends?|today|tomorrow|tonight|me|it|this|that|the|my)$/i;

/** Brand names that are everyday words, so only an exact match counts. */
const NEVER_FUZZY: ReadonlySet<string> = new Set([
  "apple",
  "prime",
  "target",
  "booking",
  "sky",
  "orange",
  "three",
  "next",
  "boots",
  "noon",
  "grab",
  "bolt",
  "mango",
  "gymshark",
]);

/** Everyday words a brand's typo check could catch. */
const REAL_WORDS: ReadonlySet<string> = new Set([
  "abode",
  "shine",
  "chroma",
  "plane",
  "price",
  "pride",
  "prize",
  "crime",
  "under",
  "other",
  "after",
  "offer",
  "tickets",
  "hotel",
  "hotels",
  "flight",
  "flights",
  "family",
  "shoes",
  "coffee",
  "dinner",
  "lunch",
  "pizza",
  "phone",
  "paris",
  "nikes",
  "tablet",
  "target",
  "amazing",
  "premium",
]);

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordsOf(task: string): string[] {
  return task
    .toLowerCase()
    .split(/[^\p{L}\d&+-]+/u)
    .filter(Boolean);
}

/** The aliases a typo could be aimed at, as one word each: "book my show" reads "bookmyshow". */
function typoTargets(byAlias: ReadonlyMap<string, Brand>): [string, Brand][] {
  return [...byAlias].flatMap(([alias, brand]) => {
    const joined = alias.replaceAll(" ", "");
    return NEVER_FUZZY.has(joined) ? [] : [[joined, brand] as [string, Brand]];
  });
}

function typedBrands(task: string, byAlias: ReadonlyMap<string, Brand>): Brand[] {
  const words = wordsOf(task).filter((word) => !REAL_WORDS.has(word));
  const targets = typoTargets(byAlias);
  return words.flatMap((word, index) => {
    const pair = `${word}${words[index + 1] ?? ""}`;
    const hit = targets.find(([alias]) => isTypoOf(word, alias) || isTypoOf(pair, alias));
    return hit ? [hit[1]] : [];
  });
}

/** Brands the task names, in the order it names them. A longer name wins over a shorter one. */
export function namedBrands(task: string, brands: readonly Brand[]): Brand[] {
  const byAlias = new Map<string, Brand>();
  for (const brand of brands) {
    for (const alias of brand.aliases) {
      if (!byAlias.has(alias)) byAlias.set(alias, brand);
    }
  }
  if (byAlias.size === 0) return [];

  const anyAlias = [...byAlias.keys()]
    .toSorted((a, b) => b.length - a.length)
    .map(escapeForRegExp)
    .join("|");
  const word = new RegExp(`(?<![\\p{L}\\d])(?:${anyAlias})(?![\\p{L}\\d])`, "gu");

  const found = new Set<Brand>();
  for (const [alias] of task.toLowerCase().matchAll(word)) {
    const brand = byAlias.get(alias);
    if (brand) found.add(brand);
  }
  return found.size > 0 ? [...found] : [...new Set(typedBrands(task, byAlias))];
}

export function domainsIn(task: string): Site[] {
  return [...task.matchAll(ADDRESS)].map(([address]) => {
    const url = /^https?:/i.test(address) ? address : `https://${address}`;
    return { name: new URL(url).hostname.replace(/^www\./, ""), url };
  });
}

/** Words that open a request and say nothing of who sells the thing. */
const OPENING_WORD =
  /^(buy|get|order|book|a|an|the|my|some|cheap|cheapest|new|best|good|need|want|i|to|try|cancel|sign|up|for|subscribe|start|choose|how|do|can|help|me|please|find|looking|gaming|noise|running|winter|womens|mens|kids|comprar|kaufen|acheter|beli|billet|abonnement|\d+)$/;
/** Words that end a name, because what follows it is the product or the terms. */
const AFTER_A_NAME =
  /^(plan|plans|premium|subscription|membership|trial|ticket|tickets|deal|deals|online|gold|pro|plus|sale|under|in|to|from|on|at|for|near|this|next|vs|and|with|or)$/;
const LONGEST_NAME = 2;
const SHORTEST_NAME = 3;

/** What may be a brand at the front of a task, such as "zee5 premium", for Search to confirm. */
export function leadingName(task: string): string | null {
  const words = wordsOf(task);
  const start = words.findIndex((word) => !OPENING_WORD.test(word));
  const name: string[] = [];
  for (const word of words.slice(start === -1 ? words.length : start)) {
    if (AFTER_A_NAME.test(word) || isCategoryWord(word) || name.length === LONGEST_NAME) break;
    name.push(word);
  }
  const joined = name.join(" ");
  return joined.replaceAll(" ", "").length >= SHORTEST_NAME ? joined : null;
}

/** A site the task seems to name that is in no data file, such as "shoes on Decathlon". */
export function unknownSiteIn(task: string): string | null {
  const named = NAMED_AFTER_WORD.exec(task);
  const preposition = named?.[1];
  const name = named?.[2] ?? NAMED_LAST.exec(task)?.[1];

  if (!name || NOT_A_SITE.test(name)) return null;
  // "From Mumbai" and "at Heathrow" in a travel task are places, not shops.
  if (preposition !== "on" && isTravelTask(task)) return null;
  return name;
}
