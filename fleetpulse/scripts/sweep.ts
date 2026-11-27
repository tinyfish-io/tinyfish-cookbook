import { runSweepAndSave } from "../src/lib/orchestrate";

async function main() {
  const startedAt = Date.now();
  console.log("[sweep-script] starting...");
  const result = await runSweepAndSave("github-actions-cron");
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[sweep-script] done in ${seconds}s — vehicles swept: ${result.vehiclesSwept}`);
}

main().catch((err) => {
  console.error("[sweep-script] failed:", err);
  process.exit(1);
});
