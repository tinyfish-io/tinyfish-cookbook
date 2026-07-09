// Run by .github/workflows/sweep.yml daily at 8am Vietnam time. Runs
// entirely outside Vercel so there's no execution time cap — the real
// 5-site competitor sweep can take as long as it needs.
import { runSweepAndSave } from "../lib/orchestrate";

async function main() {
  const startedAt = Date.now();
  console.log("[sweep] starting...");
  const result = await runSweepAndSave("github-actions-cron");
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[sweep] done in ${seconds}s — sites swept: ${result.sitesSwept}, new restock flags: ${result.newRestockFlags}`);
}

main().catch((err) => {
  console.error("[sweep] failed:", err);
  process.exit(1);
});
