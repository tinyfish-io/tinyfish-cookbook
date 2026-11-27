import type { PageTerm } from "./pageTerms.ts";
import { readTerms } from "./pageTerms.ts";
import { label, MONEY, plain } from "./pageWords.ts";
import type { PatternId } from "./types.ts";

/** A message found on the page, named for the pattern it belongs to. */
export interface PageMessage {
  kind: PatternId;
  text: string;
}

export interface PageAnchor {
  quote: string;
  price: number;
  referencePrice: number;
}

/** What a saved page says for itself, whatever the agent wrote down about it. */
export interface PageSignals {
  pressure: PageMessage[];
  anchors: PageAnchor[];
  splitPrices: string[];
  declines: string[];
  preticked: string[];
  cookieAccept: string | null;
  terms: PageTerm[];
}

const MESSAGES: readonly (readonly [PatternId, RegExp])[] = [
  [
    "scarcity_message",
    /\b(?:(?:only|just|we have)\s+\d{1,3}\s+(?:[a-z]+\s+){0,2}?(?:left|remaining|available)\b(?:\s+(?:at this price|in stock|on our site))?|\d{1,3}\s+(?:left|remaining)\s+(?:in stock|at this price)\b|(?:almost|nearly)\s+(?:gone|sold out)\b|low stock\b|last tickets\b|few (?:seats|rooms|tickets|left)\b(?:\s+left)?|limited (?:availability|stock|seats)\b|\d{1,3}% of [a-z ]{3,40}(?:unavailable|booked|sold out|gone)\b(?: for your dates)?)/gi,
  ],
  [
    "high_demand",
    /\b(?:selling|filling|going|booking)(?: out)? fast\b|\b(?:in )?high demand\b(?! (?:surge|fee|charge))|\blikely to sell out\b|\bselling out\b|\bsell out soon\b/gi,
  ],
  [
    "activity_message",
    /\b(?:\d[\d,.]*[km]?\+?\s+(?:people|others|customers|users|travell?ers|guests|shoppers|buyers)\s+(?:(?:are|have|just|also|recently)\s+)*(?:looking|viewing|viewed|watching|booked|bought|purchased|added)\b[^.!?|<]{0,32}|booked\s+\d[\d,]*\s+times\b[^.!?|<]{0,24}|\d[\d,.]*[km]?\+?\s+(?:bought|sold|booked)\s+(?:today|this week|in (?:the )?(?:past|last)\b[^.!?|<]{0,16}))/gi,
  ],
  [
    "countdown",
    /\b(?:(?:offer|sale|deal|discount|promotion|price)s?\s+(?:ends?|expires?)\s+(?:in|today|tonight|soon|at|on|by)\b[^.!?|<]{0,24}|(?:ends|expires)\s+in\s+\d+\s*(?:d|h|m|s|days?|hours?|hrs?|mins?|minutes?|seconds?)\b|limited[- ]time (?:deal|offer|sale|discount)\b|today only\b|last chance\b[^.!?|<]{0,24}|time (?:left|remaining)\b[:\s]*\d{1,2}:\d{2}|(?:held|reserved)\s+for\s+\d{1,2}:\d{2})/gi,
  ],
];

const WAS_NOW = new RegExp(
  String.raw`\b(?:original price|was|list price|regular price|mrp)\b[:\s]*(${MONEY})[.,]?[\s|]*(?:current price|now|sale price|offer price)\b[:\s]*(${MONEY})`,
  "gi",
);
const AFTER_STRUCK = new RegExp(String.raw`^[\s|]*((?:[A-Z]{2,3})?${MONEY})`);
const SPLIT_PRICE = new RegExp(
  String.raw`(?:${MONEY}[\s|]*(?:\+|\bplus\b)\s*(?:${MONEY}\s+)?|\+\s*${MONEY}\s+)(?:[a-z&-]+\s+){0,3}?(?:fees?|charges?|surcharges?)\b`,
  "gi",
);
const INCLUDED_AFTER = /^\s*(?:are |is )?included\b/i;

export const SHAMING_DECLINE =
  /risk it|take the risk|i don'?t (want|need|care)|no,? i (prefer|like|'?ll pay|will pay)|i prefer pay|pay (more|full price)|full price|stay unprotected|stay unsecured|no protection|miss out|not interested in saving|give up (my|this)|lose my/i;
const MAX_CONTROL_LENGTH = 80;

const MARKETING = /market|promot|personali[sz]ed|newsletter|special offers|\boffers\b|third part/i;
const COOKIE_WORD = /cookie/i;
const COOKIE_ACCEPT = /^(?:ok,? ?)?(?:i )?(?:accept|agree|allow)(?: all| to all)?(?: cookies)?$/i;
const COOKIE_REFUSE = /reject|decline|deny|refuse|necessary|essential|opt[- ]out|do not sell/i;
const LABEL_LENGTH = 160;
const NEARBY_HTML = 3000;
const NEARBY_TEXT = 400;

const CONTROL = /<(button|a|label)\b[^>]*>([\s\S]*?)<\/\1>|<input\b[^>]*\bvalue="([^"]*)"[^>]*>/gi;
const TICKED_BOX = /<input\b(?=[^>]*\btype=["']?checkbox)(?=[^>]*\schecked\b)[^>]*>/gi;
const ARIA_LABEL = /\baria-label\s*=\s*"([^"]*)"/i;
const HIDDEN_TAG =
  /<([a-z][\w-]*)\b(?=[^>]*(?:\shidden\b|style\s*=\s*["'][^"']*(?:display:\s*none|visibility:\s*hidden)|class\s*=\s*["'][^"']*\b(?:modal-hide|is-hidden|d-none|sr-only|visually-hidden)\b))[^>]*>/gi;

const STRUCK_TAG =
  /<(?:(s|del|strike)\b[^>]*|([a-z][\w-]*)\b(?=[^>]*(?:class|data-template)\s*=\s*["'][^"']*(?:strike|line-through))[^>]*)>/gi;
const STRUCK_START = "\u0001";
const STRUCK_END = "\u0002";

function tagName(tag: string): string {
  return /^<\/?([a-z][\w-]*)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
}

/** Where the element opened at `from` closes, counting nested tags of the same name. */
function closingIndex(html: string, name: string, from: number): number {
  const tags = new RegExp(`</?${name}\\b[^>]*>`, "gi");
  tags.lastIndex = from;
  let depth = 1;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0].startsWith("</") ? -1 : match[0].endsWith("/>") ? 0 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return html.length;
}

function withoutHidden(html: string): string {
  const kept: string[] = [];
  let at = 0;
  HIDDEN_TAG.lastIndex = 0;
  for (let match = HIDDEN_TAG.exec(html); match; match = HIDDEN_TAG.exec(html)) {
    if (match.index < at) continue;
    kept.push(html.slice(at, match.index));
    at = closingIndex(html, tagName(match[0]), match.index + match[0].length);
    HIDDEN_TAG.lastIndex = at;
  }
  kept.push(html.slice(at));
  return kept.join(" ");
}

function words(text: string): string {
  return text.replaceAll("|", " ").replace(/\s+/g, " ").trim();
}

function amountOf(money: string): number {
  return Number(money.replace(/[^\d.]/g, ""));
}

function unique<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item).toLowerCase(), item])).values()];
}

function messagesIn(text: string): PageMessage[] {
  return MESSAGES.flatMap(([kind, wording]) =>
    [...text.matchAll(wording)].map((match) => ({ kind, text: match[0].trim() })),
  );
}

/** Marks what the page crosses out, whether by a tag or by a class on an element. */
function markStruck(html: string): string {
  const kept: string[] = [];
  let at = 0;
  for (const { 0: tag, 1: plainTag, 2: styledTag = "", index } of html.matchAll(STRUCK_TAG)) {
    if (index < at) continue;
    const start = index + tag.length;
    const end = closingIndex(html, plainTag ?? styledTag, start);
    kept.push(html.slice(at, index), STRUCK_START, html.slice(start, end), STRUCK_END);
    at = end;
  }
  kept.push(html.slice(at));
  return kept.join("");
}

function struckAnchors(marked: string): PageAnchor[] {
  const pieces = marked.split(STRUCK_START).slice(1);
  return pieces.flatMap((piece) => {
    const [struck = "", rest = ""] = piece.split(STRUCK_END);
    const reference = new RegExp(MONEY, "i").exec(words(struck))?.[0];
    const after = AFTER_STRUCK.exec(rest)?.[1];
    if (!reference || !after) return [];
    const anchor = {
      quote: `${words(struck)} ${after}`,
      referencePrice: amountOf(reference),
      price: amountOf(after),
    };
    return anchor.referencePrice > anchor.price ? [anchor] : [];
  });
}

function wordedAnchors(text: string): PageAnchor[] {
  return [...text.matchAll(WAS_NOW)].flatMap(([quote, was = "", now = ""]) => {
    const anchor = { quote, referencePrice: amountOf(was), price: amountOf(now) };
    return anchor.referencePrice > anchor.price ? [anchor] : [];
  });
}

function splitPrices(text: string): string[] {
  return [...text.matchAll(SPLIT_PRICE)]
    .filter(({ 0: split, index }) => !INCLUDED_AFTER.test(text.slice(index + split.length)))
    .map(([split]) => words(split));
}

function controlsIn(html: string): string[] {
  return [...html.matchAll(CONTROL)]
    .map(([, , inner, value]) => label(inner ?? value ?? ""))
    .filter(({ length }) => length > 0 && length <= MAX_CONTROL_LENGTH);
}

function tickedLabels(html: string): string[] {
  return [...html.matchAll(TICKED_BOX)].flatMap(({ 0: box, index }) => {
    const named = ARIA_LABEL.exec(box)?.[1];
    const after = html.slice(index + box.length, index + box.length + LABEL_LENGTH * 4);
    const words = label(named ?? after.split(/<\/label>|<input\b/i)[0] ?? "");
    return MARKETING.test(words) ? [words.slice(0, LABEL_LENGTH)] : [];
  });
}

/** A banner's words and buttons sit together, so only what is close to the button counts. */
function cookieAcceptIn(html: string): string | null {
  for (const { 0: tag, index } of html.matchAll(CONTROL)) {
    const words = label(tag);
    if (!COOKIE_ACCEPT.test(words)) continue;
    const before = label(html.slice(Math.max(0, index - NEARBY_HTML), index)).slice(-NEARBY_TEXT);
    const after = label(html.slice(index, index + NEARBY_HTML)).slice(0, NEARBY_TEXT);
    const nearby = `${before} ${after}`;
    if (COOKIE_WORD.test(nearby) && !COOKIE_REFUSE.test(nearby)) return words;
  }
  return null;
}

export function readSignals(html: string): PageSignals {
  const visible = withoutHidden(
    html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " "),
  );
  const text = plain(visible);
  const marked = plain(markStruck(visible));
  const controls = controlsIn(visible);

  return {
    pressure: unique(messagesIn(text), ({ text: words }) => words),
    anchors: unique([...struckAnchors(marked), ...wordedAnchors(text)], ({ quote }) => quote),
    splitPrices: unique(splitPrices(text), (words) => words),
    declines: unique(
      controls.filter((label) => SHAMING_DECLINE.test(label)),
      (label) => label,
    ),
    preticked: unique(tickedLabels(visible), (label) => label),
    cookieAccept: cookieAcceptIn(visible),
    terms: unique(readTerms(visible), ({ term, quote }) => term + quote),
  };
}
