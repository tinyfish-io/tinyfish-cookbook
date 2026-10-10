// Run daily by .github/workflows/sweep.yml at 11:30 AM Vietnam time. The
// cron fires every day, but runSweep() only actually processes searches
// where 48+ hours have passed since their last check — so a simple daily
// schedule still yields a real per-search 48h cadence without fighting
// cron syntax for multi-day intervals.
import { runSweep } from "../src/lib/orchestrate";

async function main() {
  const startedAt = Date.now();
  console.log("[sweep-script] starting...");
  const result = await runSweep("github-actions-cron");
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[sweep-script] done in ${seconds}s — portals swept: ${result.portalsSwept}, searches swept: ${result.searchesSwept}`);
}

main().catch((err) => {
  console.error("[sweep-script] failed:", err);
  process.exit(1);
});
