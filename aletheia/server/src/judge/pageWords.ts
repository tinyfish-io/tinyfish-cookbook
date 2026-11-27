export const MONEY = String.raw`(?:₹|\$|£|€|Rs\.?|INR|USD|EUR|GBP|AED|SGD|AUD|CAD)\s?\d[\d,]*(?:\.\d+)?`;

const INLINE_TAG = /<\/?(?:a|abbr|b|em|font|i|mark|s|small|span|strong|sub|sup|u)\b[^>]*>/gi;
// Stands between blocks, so a message never runs on into the next element.
const BLOCK_END = " | ";

function decoded(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** A page's words, with a mark wherever one block of the page ends and the next begins. */
export function plain(html: string): string {
  return decoded(html.replace(INLINE_TAG, "").replace(/<[^>]*>/g, BLOCK_END));
}

/** The words of a short piece of html, whatever blocks hold them. */
export function label(html: string): string {
  return decoded(html.replace(/<[^>]*>/g, " "));
}
