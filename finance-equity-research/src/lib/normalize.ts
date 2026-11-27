import type { Family } from "./sources";

// Turns a raw source payload (markdown, JSON, agent output) into evidence rows
// + a headline metric via OpenAI. Model is configurable; extraction is a
// mini-class job, so default cheap.
const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

// family_read is a judgment call — give the model an analyst's rubric, not vibes
const FAMILY_RUBRICS: Record<Family, string> = {
  sentiment:
    "Ratings ≤3/5, complaint-dominated reviews, or majority-negative posts = deteriorating (15-40; TrustScore 'Bad' ≤ 25). Mixed = 40-55. Clear positive trend = above 55.",
  workforce:
    "A layoff within the last 6 months = strongly deteriorating (20-35, larger/more recent = lower). Shrinking postings = 35-45. Stable or growing postings WITH no recent layoffs = 50-65. Never score above 50 when a layoff occurred in the last 90 days.",
  leadership:
    "Unplanned CEO/CFO departure within 90 days = 30-40; within a year = 40-50. Stable, long-tenured leadership = 50-60.",
  ops: "Active outage spike vs baseline = 25-40. Quiet status page / normal report volume = 50-55.",
};

export type EvidenceItem = {
  quote: string;
  source_label: string;
  source_url: string | null;
  published_at: string | null; // YYYY-MM-DD
  sentiment: number; // -1..1
};

export type NormalizedSource = {
  items: EvidenceItem[];
  metric: {
    value: number | null;
    unit: string | null;
    note: string;
  } | null;
  family_read: number | null; // 0-100 directional read for this source alone
};

export async function normalizeSource(opts: {
  companyName: string;
  sourceKey: string;
  sourceLabel: string;
  family: Family;
  raw: unknown;
  metricHint?: string;
}): Promise<NormalizedSource> {
  const rawText = typeof opts.raw === "string" ? opts.raw : JSON.stringify(opts.raw);
  const clipped = rawText.length > 60_000 ? rawText.slice(0, 60_000) : rawText;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You extract equity-research evidence from raw scraped web content. Company under analysis: ${opts.companyName}. Source: ${opts.sourceLabel} (signal family: ${opts.family}).
Return STRICT JSON:
{"items":[{"quote":"short VERBATIM excerpt, max 200 chars, must appear in the input","source_url":"url if identifiable else null","published_at":"YYYY-MM-DD or null","sentiment":-1..1}],
 "metric":{"value":number|null,"unit":"string|null","note":"one factual line about what this source shows"},${opts.metricHint ? `\nThe metric MUST be: ${opts.metricHint}. If that exact figure is not in the input, metric.value = null — never substitute a different number.` : ""}
 "family_read":0-100}
Rules: items must be real verbatim excerpts about the company (max 8, most signal-bearing). NEVER invent, paraphrase, or guess — if a field is not locatable in the input, use null; if nothing qualifies, return items:[]. Extracted quotes are checked against the input verbatim and fabrications are discarded.
family_read: 50=neutral, below=deteriorating, above=improving, judged ONLY from this input, scored by this rubric: ${FAMILY_RUBRICS[opts.family]} If the input has nothing about the company, return items:[], metric:null, family_read:null.`,
        },
        { role: "user", content: clipped },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`normalize(${opts.sourceKey}): OpenAI ${response.status} — ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0].message.content) as {
    items?: { quote?: string; source_url?: string | null; published_at?: string | null; sentiment?: number }[];
    metric?: { value: number | null; unit: string | null; note: string } | null;
    family_read?: number | null;
  };

  return {
    items: (parsed.items ?? [])
      .filter((item) => typeof item.quote === "string" && item.quote.trim().length > 0)
      .map((item) => ({
        quote: item.quote!.trim(),
        source_label: opts.sourceLabel,
        source_url: item.source_url ?? null,
        published_at: item.published_at ?? null,
        sentiment: clamp(item.sentiment ?? 0, -1, 1),
      })),
    metric: parsed.metric ?? null,
    family_read: parsed.family_read == null ? null : clamp(parsed.family_read, 0, 100),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Anti-hallucination gate (bestbet-style): a quote extracted from fetched text
 * must actually appear in that text, modulo whitespace/case/quotes. Drops the
 * rest and reports how many died.
 */
export function verifyQuotes(items: EvidenceItem[], rawText: string): { verified: EvidenceItem[]; dropped: number } {
  const haystack = squash(rawText);
  const verified = items.filter((item) => haystack.includes(squash(item.quote)));
  return { verified, dropped: items.length - verified.length };
}

function squash(s: string) {
  return s
    .toLowerCase()
    .replace(/[“”"'‘’`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
