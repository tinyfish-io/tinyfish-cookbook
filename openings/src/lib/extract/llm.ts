import { generateText, Output } from "ai";
import { z } from "zod";
import { extractedSchema, type Extracted } from "../job";

const MODEL = process.env.EXTRACT_MODEL ?? "openai/gpt-4.1-mini";
// Postings put the useful parts early; the tail is mostly EEO boilerplate.
const CHARS_PER_POSTING = 3500;
// Free-tier Gateway allows ~5 requests/min per model, so postings are extracted in batches
// (15 jobs = 3 calls) rather than one call each.
export const BATCH_SIZE = 5;
const CALL_TIMEOUT_MS = 45_000;

/**
 * AI Gateway auth: an API key, or an OIDC token. Locally the token comes from `vercel env pull`
 * (VERCEL_OIDC_TOKEN); on a Vercel deployment it arrives per request (not as an env var) and the AI
 * SDK picks it up itself — so running on Vercel (VERCEL=1) counts as available.
 */
export function llmAvailable(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
}

const batchSchema = z.object({
  postings: z.array(extractedSchema.extend({ index: z.number().int().describe("The posting's [index] from the input") })),
});

/**
 * Read up to BATCH_SIZE postings in one LLM call. Each posting comes with the rule-based draft as
 * a hint, so the model only confirms or corrects it. Returns results aligned to the input; an entry
 * is null if the model skipped it (the caller keeps the rules result). Throws on call failure.
 */
export async function extractBatchWithLlm(items: { text: string; hint: Extracted }[]): Promise<(Extracted | null)[]> {
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: batchSchema }),
    temperature: 0,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    system: [
      "You extract structured facts from job postings for a student job search.",
      "Return one entry per input posting, with its [index].",
      "Only state what each posting says. Use null / 'unknown' / [] when it doesn't say.",
      "company: the hiring company's proper name as the posting states it (e.g. 'Capital One', not 'Capitalone');",
      "the draft's company comes from a URL and may be a slug, team or location — correct it from the posting text.",
      "visa: 'no_sponsorship' only if the posting says it won't sponsor or requires authorization without sponsorship;",
      "'sponsors' only if it explicitly offers sponsorship.",
    ].join(" "),
    prompt: items
      .map(
        (item, i) =>
          `[${i}] Draft from simple rules (may be wrong or incomplete): ${JSON.stringify(item.hint)}\n` +
          `[${i}] Posting:\n"""\n${item.text.slice(0, CHARS_PER_POSTING)}\n"""`,
      )
      .join("\n\n"),
  });

  const byIndex = new Map(output.postings.map(({ index, ...rest }) => [index, rest]));
  return items.map((_, i) => byIndex.get(i) ?? null);
}
