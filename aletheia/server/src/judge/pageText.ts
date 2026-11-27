import type { PageSignals } from "./pageSignals.ts";
import { readSignals } from "./pageSignals.ts";

/** The text of one page the agent saw, tied to the step whose screenshot shows it. */
export interface PageCapture {
  stepId: string;
  text: string;
  signals?: PageSignals;
}

const MIN_QUOTE_LENGTH = 3;
// Each side of an elided quote has to be long enough to mean something on its own.
const MIN_ELIDED_PART_LENGTH = 8;

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&apos;": "'",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&rupee;": "₹",
};

// Words a page keeps in an attribute: a submit button's label, an icon button's name, an image's text.
const SPOKEN_ATTRIBUTE = /\b(?:value|aria-label|alt)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const HIDDEN_FIELD = /\btype\s*=\s*["']?hidden/i;
const ELLIPSIS = /\.{3,}|…/;
const EDGE_PUNCTUATION = /^["'“”‘’(\s]+|["'“”‘’).,;:!\s]+$/g;

function decode(entity: string): string {
  const number = /^&#(x?)([0-9a-f]+);$/i.exec(entity);
  if (number?.[2]) return String.fromCodePoint(parseInt(number[2], number[1] ? 16 : 10));
  return NAMED_ENTITIES[entity.toLowerCase()] ?? entity;
}

function spokenWords(tag: string): string {
  if (HIDDEN_FIELD.test(tag)) return "";
  return [...tag.matchAll(SPOKEN_ATTRIBUTE)].map((match) => match[1] ?? match[2] ?? "").join(" ");
}

/** Spacing and punctuation style vary between a page and an agent's copy of it. Words do not. */
export function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[­​-‍⁠﻿]/g, "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, "");
}

export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, spokenWords)
    .replace(/&[a-z#0-9]+;/gi, decode);
  return comparable(text);
}

export function capturePage(stepId: string, html: string): PageCapture {
  return { stepId, text: htmlToText(html), signals: readSignals(html) };
}

/**
 * Where the words start on a page, or -1. An agent may drop the middle of a long line, but both
 * sides must still be there, in order.
 */
function positionOf(text: string, parts: readonly string[]): number {
  let from = 0;
  let start = -1;
  for (const part of parts) {
    const at = text.indexOf(part, from);
    if (at < 0) return -1;
    if (start < 0) start = at;
    from = at + part.length;
  }
  return start;
}

function quoteParts(quote: string): string[] | null {
  const parts = quote
    .split(ELLIPSIS)
    .map((part) => comparable(part.replace(EDGE_PUNCTUATION, "")))
    .filter(Boolean);
  if (parts.join("").length < MIN_QUOTE_LENGTH) return null;
  const elided = parts.length > 1;
  return elided && parts.some((part) => part.length < MIN_ELIDED_PART_LENGTH) ? null : parts;
}

/** The page that holds these words, starting with the page the agent named if it has them. */
export function locateQuote(
  quote: string,
  captures: readonly PageCapture[],
  preferredStepId: string | null = null,
): string | null {
  const parts = quoteParts(quote);
  if (!parts) return null;
  const preferred = captures.find((capture) => capture.stepId === preferredStepId);
  if (preferred && positionOf(preferred.text, parts) >= 0) return preferred.stepId;

  const holding = captures
    .map(({ stepId, text }) => ({ stepId, at: positionOf(text, parts) }))
    .filter(({ at }) => at >= 0);
  return (
    holding.reduce((best, page) => (page.at < best.at ? page : best), holding[0]!)?.stepId ?? null
  );
}
