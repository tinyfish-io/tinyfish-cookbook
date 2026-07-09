// Runs INSIDE the GitHub Actions runner — this is the real compute, not
// just a ping to Vercel. Uses the same progressive sweep as the
// interactive "Sync now" button (runSweepStreaming) rather than the older
// batch-only runSweep() — that one only wrote to Redis once, at the very
// end of all 5 banks, so a page refresh mid-sweep showed nothing new even
// after several banks had genuinely finished. This writes as each bank
// resolves, same as everywhere else.
import { runSweepStreaming } from "../src/lib/sweep";

async function main() {
  console.log("[sweep-script] starting real sweep inside GitHub Actions runner...");
  const state = await runSweepStreaming((event, data) => {
    console.log(`[sweep-script] ${event}`, data);
  });
  console.log(`[sweep-script] complete — ${state.listings.length} listings, live=${state.live}`);
}

main().catch((err) => {
  console.error("[sweep-script] failed:", err);
  process.exit(1);
});
