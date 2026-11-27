import type { PageCapture } from "../judge/pageText.ts";
import { capturePage } from "../judge/pageText.ts";
import type { RunRecord } from "../tinyfish/types.ts";

const CONCURRENT_FETCHES = 4;

interface HtmlClient {
  getStepHtml(runId: string, stepId: string): Promise<string>;
}

/**
 * Reads the page saved at each step, for matching quotes. The text stays in memory for the
 * length of one judgement and is never stored, since a signed-in page shows personal details.
 */
export async function collectPageText(
  client: HtmlClient,
  { run_id: runId, steps }: RunRecord,
): Promise<PageCapture[]> {
  const captured = steps.filter((step) => step.html);
  const pages: PageCapture[] = [];

  for (let start = 0; start < captured.length; start += CONCURRENT_FETCHES) {
    const batch = captured.slice(start, start + CONCURRENT_FETCHES);
    const results = await Promise.allSettled(
      batch.map((step) =>
        client.getStepHtml(runId, step.id).catch(() => client.getStepHtml(runId, step.id)),
      ),
    );
    results.forEach((result, index) => {
      const stepId = batch[index]?.id;
      if (stepId && result.status === "fulfilled") {
        pages.push(capturePage(stepId, result.value));
      }
    });
  }

  return pages;
}
