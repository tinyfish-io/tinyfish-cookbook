/**
 * Run the full Phase 1 pipeline from the terminal and print structured jobs.
 *   npm run pipeline -- --role "software engineer" --loc "New York,Remote" --seniority internship --companies "roblox,palantir"
 *   add --agent 2 to allow up to 2 metered Agent runs (portals + pages Fetch can't render)
 *   add --keywords "python,ml" --visa --grad 2027 to shape the ranking
 */
import { parseArgs } from "node:util";
import { runPipeline } from "../src/lib/pipeline";

const { values } = parseArgs({
  options: {
    role: { type: "string", default: "software engineer" },
    loc: { type: "string", default: "New York,Remote" },
    seniority: { type: "string", default: "internship" },
    companies: { type: "string", default: "" },
    limit: { type: "string", default: "15" },
    agent: { type: "string", default: "0" },
    keywords: { type: "string", default: "" },
    visa: { type: "boolean", default: false },
    grad: { type: "string", default: "" },
  },
});
const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const { jobs, filtered, stats } = await runPipeline(
  {
    role: values.role!,
    locations: split(values.loc!),
    seniority: values.seniority as "internship" | "new_grad" | "any",
    keywords: split(values.keywords!),
    needsVisa: values.visa!,
    companies: split(values.companies!),
    gradYear: values.grad ? Number(values.grad) : null,
  },
  {
    readLimit: Number(values.limit),
    agentRuns: Number(values.agent),
    onProgress: (stage, msg) => console.log(`  [${stage}] ${msg}`),
    onAgentEvent: (e) => {
      if (e.type === "started") console.log(`  [agent] ▶ ${e.purpose} ${e.url}`);
      if (e.type === "live") console.log(`          live view: ${e.streamingUrl}`);
      if (e.type === "done") console.log(`  [agent] ■ ${e.log.purpose} ${e.log.ok ? "ok" : "failed"} in ${(e.log.ms / 1000).toFixed(0)}s, found ${e.log.found}${e.log.error ? ` (${e.log.error})` : ""}`);
    },
  },
);

const { agent, firecrawl, rank, ...rest } = stats;
console.log("\nstats", JSON.stringify(rest));
console.log("agent", JSON.stringify({ budget: agent.budget, used: agent.used }));
console.log("firecrawl", JSON.stringify(firecrawl));
console.log("rank", JSON.stringify(rank));
console.table(
  jobs.map((j) => ({
    score: j.score,
    company: j.company?.slice(0, 18),
    title: j.title.slice(0, 40),
    loc: j.location?.slice(0, 22),
    where: j.workplace,
    lvl: j.seniority,
    term: j.term,
    grad: j.gradYears.join("/"),
    pay: j.pay?.slice(0, 22),
    visa: j.visa,
    via: `${j.foundBy}/${j.ats}${j.readBy !== "fetch" ? `/read:${j.readBy}` : ""}`,
  })),
);

console.log("\nwhy the top 5 matched:");
for (const j of jobs.slice(0, 5)) {
  console.log(`  ${j.score}  ${j.company} — ${j.title}`);
  console.log(`      ${j.reasons.map((r) => (r.kind === "plus" ? "+ " : "· ") + r.text).join("   ")}`);
  if (j.duplicates.length) console.log(`      also posted at ${j.duplicates.length} other URL(s)`);
}
if (filtered.length) {
  console.log("\nfiltered out:");
  for (const f of filtered) console.log(`  ✗ ${f.company} — ${f.title}: ${f.reason}`);
}
