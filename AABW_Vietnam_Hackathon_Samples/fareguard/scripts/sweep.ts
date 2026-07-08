// Run by .github/workflows/sweep.yml every 8 hours. This is intentionally
// NOT a Vercel route — GitHub Actions runners have no per-job time limit
// anywhere near Vercel's, so the full 7-site TinyFish sweep (and the daily
// Groq analysis, when due) can take as long as it actually needs.
//
// Run manually with: npx tsx scripts/sweep.ts
// Requires the same env vars as the app: TINYFISH_API_KEY,
// KV_REST_API_URL, KV_REST_API_TOKEN, GROQ_API_KEY (optional).

import { runSweepAndMaybeAnalyze } from "../lib/orchestrate";

async function main() {
  const startedAt = Date.now();
  console.log("[sweep] starting...");
  const result = await runSweepAndMaybeAnalyze("github-actions-cron");
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[sweep] done in ${seconds}s — sites swept: ${result.sitesSwept}, booking requests triggered: ${result.triggeredCount}, ran analysis: ${result.analyzed}`
  );
}

main().catch((err) => {
  console.error("[sweep] failed:", err);
  process.exit(1);
});
