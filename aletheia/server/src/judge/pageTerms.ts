import { label, MONEY } from "./pageWords.ts";
import type { ShownWhere, TermName } from "./types.ts";

/** Where the page tucks a line away. Null means it sits in the page's ordinary text. */
export type TermPlace = Extract<ShownWhere, "fine_print" | "faq" | "info_icon"> | null;

/** A line of a subscription's terms, read off the page with the place it sits in. */
export interface PageTerm {
  term: TermName;
  quote: string;
  place: TermPlace;
}

interface Block {
  words: string;
  place: TermPlace;
}

const TERM_WORDING: readonly (readonly [TermName, RegExp])[] = [
  [
    "renewal",
    /\brenews? automatically\b|\bautomatically (?:renews?|charged|billed)\b|\bauto-?renew|\brecurring (?:charge|payment|billing|subscription)\b|\b(?:unless|until) (?:you )?cancel/i,
  ],
  [
    "cancellation",
    /\bcancel (?:any ?time|at any time|online|before|by|up to|your|in|through|via)\b|\bto cancel\b|\bcancell?ation (?:takes|policy|terms|must)\b/i,
  ],
  [
    "cancellation_fee",
    /\b(?:termination|cancell?ation) (?:fee|charge)s?\b|\bfee applies\b|\bremaining (?:commitment|balance|months|contract)\b/i,
  ],
  [
    "trial",
    /\b\d+[- ](?:day|week|month)s?[- ](?:free[- ])?trial\b|\bfree trial\b|\bfree for \d+\b|\b\d+ (?:days?|weeks?|months?) free\b/i,
  ],
  [
    "trial_card",
    /\b(?:credit|debit|payment) (?:card|method|details)\b[^.]{0,40}\b(?:required|needed)\b|\b(?:required|need)\b[^.]{0,40}\b(?:credit|debit|payment) (?:card|method|details)\b/i,
  ],
  [
    "price_after_intro",
    new RegExp(
      String.raw`\bthen\s+${MONEY}|${MONEY}[^.]{0,40}\bthereafter\b|\brenews? at\s+${MONEY}|\bafter (?:the |your )?(?:trial|intro|offer|promo)[^.]{0,30}${MONEY}`,
      "i",
    ),
  ],
];
const NO_FEE =
  /\bno (?:cancell?ation |termination )?(?:fee|charge|penalt)|without (?:any )?(?:fee|charge|penalt)|free of charge/i;

const TAG = /<(\/?)([a-z][\w-]*)\b[^>]*>/gi;
const NAMING_ATTRIBUTE = /\b(?:class|id|data-testid)\s*=\s*["']([^"']*)["']/gi;
const NO_CLOSING_TAG = new Set(
  "area base br col embed hr img input link meta source track wbr".split(" "),
);
const INLINE = new Set("a abbr b em font i mark s span strong sup u".split(" "));
const SMALL_TAGS = new Set(["small", "footer", "sub"]);
const FAQ_NAME = /faq|accordion/i;
const TOOLTIP_NAME = /tooltip|popover/i;
const SMALL_PRINT_NAME = /disclaimer|legal|fine-?print|small-?print|footnote/i;
const SENTENCE_END = /(?<=[.!?])(?<!\b(?:mo|yr|wk|incl|excl|approx)\.)\s+/i;
const MAX_QUOTE = 320;

function placeOfTag(name: string, tag: string): TermPlace {
  if (name === "details") return "faq";
  if (SMALL_TAGS.has(name)) return "fine_print";
  const names = [...tag.matchAll(NAMING_ATTRIBUTE)].map((match) => match[1]).join(" ");
  if (FAQ_NAME.test(names)) return "faq";
  if (TOOLTIP_NAME.test(names)) return "info_icon";
  return SMALL_PRINT_NAME.test(names) ? "fine_print" : null;
}

/** Walks the page's tags, so each run of text knows the elements around it. */
function blocksOf(html: string): Block[] {
  const blocks: Block[] = [];
  const open: { name: string; place: TermPlace }[] = [];
  let pieces: string[] = [];
  let piecesPlace: TermPlace = null;
  let at = 0;

  const flush = () => {
    const words = label(pieces.join(""));
    if (words) blocks.push({ words, place: piecesPlace });
    pieces = [];
  };

  for (const match of html.matchAll(TAG)) {
    const { 0: tag, 1: slash, 2: rawName = "", index } = match;
    const text = html.slice(at, index);
    at = index + tag.length;
    if (text) {
      const place = open.findLast((entry) => entry.place)?.place ?? null;
      if (text.trim() && place !== piecesPlace) flush();
      if (text.trim()) piecesPlace = place;
      pieces.push(text);
    }

    const name = rawName.toLowerCase();
    if (!INLINE.has(name)) flush();
    if (NO_CLOSING_TAG.has(name) || tag.endsWith("/>")) continue;
    if (slash) {
      const opened = open.findLastIndex((entry) => entry.name === name);
      if (opened >= 0) open.length = opened;
    } else {
      open.push({ name, place: placeOfTag(name, tag) });
    }
  }
  flush();
  return blocks;
}

function termsOf({ words, place }: Block): PageTerm[] {
  return words.split(SENTENCE_END).flatMap((sentence) =>
    TERM_WORDING.flatMap(([term, wording]) => {
      if (!wording.test(sentence)) return [];
      if (term === "cancellation_fee" && NO_FEE.test(sentence)) return [];
      return [{ term, quote: sentence.trim().slice(0, MAX_QUOTE), place }];
    }),
  );
}

export function readTerms(html: string): PageTerm[] {
  return blocksOf(html).flatMap(termsOf);
}
