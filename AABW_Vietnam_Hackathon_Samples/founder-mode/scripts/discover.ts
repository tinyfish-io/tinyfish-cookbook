// Run by .github/workflows/discover.yml every 8 hours. Runs outside Vercel
// entirely so it's not limited by function duration caps.
import { runDiscoveryAndSave } from "../lib/orchestrate";

async function main() {
  const startedAt = Date.now();
  console.log("[discover] starting...");
  const result = await runDiscoveryAndSave("github-actions-cron");
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[discover] done in ${seconds}s — sources swept: ${result.sitesSwept}, new programs found: ${result.newCount}, total tracked: ${result.totalPrograms}`
  );
}

main().catch((err) => {
  console.error("[discover] failed:", err);
  process.exit(1);
});
