/**
 * Phase 0 spike: exercise Search -> Fetch -> Agent against live data.
 *   npm run spike                      # search + fetch only (free)
 *   npm run spike -- --agent <url>     # also run one Agent search on a portal (metered)
 */
import { searchPostings } from "../src/lib/discover";
import { readPages } from "../src/lib/read";
import { AgentBudget, agentSearchPortal } from "../src/lib/agent";
import type { Preferences } from "../src/lib/types";

const prefs: Preferences = {
  role: "software engineer",
  locations: ["New York", "Remote"],
  seniority: "internship",
  keywords: [],
  needsVisa: false,
  companies: [],
};

function time<T>(label: string, p: Promise<T>): Promise<T> {
  const t0 = Date.now();
  return p.finally(() => console.log(`  ⏱  ${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`));
}

async function main() {
  console.log("\n① SEARCH — discover postings");
  const candidates = await time("search", searchPostings(prefs));
  const byAts = Object.groupBy(candidates, (c) => c.ats);
  console.log(`  ${candidates.length} candidates:`, Object.fromEntries(Object.entries(byAts).map(([k, v]) => [k, v!.length])));
  for (const c of candidates.slice(0, 8)) console.log(`   · [${c.ats}/${c.company}] ${c.title}`);

  console.log("\n② FETCH — read the top postings");
  const pages = await time("fetch", readPages(candidates.slice(0, 10).map((c) => c.url)));
  console.log(`  read ${pages.length}/${Math.min(10, candidates.length)} pages`);
  for (const p of pages.slice(0, 5)) {
    const visa = /visa|sponsor/i.test(p.text) ? "mentions visa" : "no visa mention";
    console.log(`   · ${p.title.slice(0, 60)} — ${p.text.length} chars, ${visa}`);
  }

  const agentIdx = process.argv.indexOf("--agent");
  if (agentIdx > -1 && process.argv[agentIdx + 1]) {
    const portal = process.argv[agentIdx + 1];
    console.log(`\n③ AGENT — search portal ${portal}`);
    const budget = new AgentBudget(1);
    budget.reserve();
    const listings = await time("agent", agentSearchPortal(budget, portal, "intern", 5));
    const [log] = budget.logs;
    console.log(`  run ${log.runId} → ${listings.length} listings${log.error ? ` (error: ${log.error})` : ""}`);
    for (const l of listings) console.log(`   · ${l.title} — ${l.location} — ${l.posted}`);
  } else {
    console.log("\n③ AGENT — skipped (pass --agent <portal-url> to run; metered)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
