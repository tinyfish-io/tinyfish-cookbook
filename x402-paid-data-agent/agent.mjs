// x402-paid-data-agent — Pay-per-call Data Agent
// TinyFish gives you the web. x402 gives you the DATA.
//
// Flow: TinyFish Search (free web discovery) -> x402 paid APIs (hard data) -> AI brief
//
// Usage:
//   TINYFISH_API_KEY=... node agent.mjs "Should I buy NVDA?"
//
// The agent:
//   1. Uses TinyFish Search to find fresh web context on the topic
//   2. Picks the right x402 paid endpoints (token score, sentiment, earnings, memo)
//   3. Pays per call in USDC on Base (x402 v2) — free-trial quota applies for first calls
//   4. Synthesizes everything into a decision brief

const TINYFISH_API_KEY = process.env.TINYFISH_API_KEY;
const X402_BASE = "https://contabo-vps.taild7e69a.ts.net";

if (!TINYFISH_API_KEY) {
  console.error("Set TINYFISH_API_KEY env var. Get one free at https://agent.tinyfish.ai");
  process.exit(1);
}

const topic = process.argv.slice(2).join(" ") || "Should I buy NVDA?";

// --- TinyFish Search (free) -------------------------------------------------
async function tinyfishSearch(query) {
  const res = await fetch("https://api.tinyfish.ai/v1/search", {
    method: "POST",
    headers: { "Authorization": `Bearer ${TINYFISH_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, num_results: 5 }),
  });
  if (!res.ok) throw new Error(`TinyFish search failed: ${res.status}`);
  return res.json();
}

// --- x402 paid call (tries free trial first, returns 402 instructions if payment needed)
async function x402Call(path, { method = "GET", body = null } = {}) {
  const url = `${X402_BASE}${path}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 402) {
    const pr = await res.json().catch(() => ({}));
    const a = pr.accepts?.[0] || {};
    return { _needsPayment: true, price: a.amount ? `${Number(a.amount) / 1e6} USDC` : "unknown", path };
  }
  return res.json();
}

// --- Main -------------------------------------------------------------------
console.log(`\n🔍 Researching: "${topic}"\n`);

// Step 1: free web discovery via TinyFish
console.log("1/4 TinyFish Search (free) — gathering web context...");
let webContext = [];
try {
  const s = await tinyfishSearch(topic);
  webContext = (s.results || []).slice(0, 5).map((r) => `- ${r.title}: ${r.snippet || r.url}`);
  console.log(`    found ${webContext.length} sources`);
} catch (e) {
  console.log(`    TinyFish unavailable (${e.message}), continuing with x402 data only`);
}

// Step 2: extract a symbol if the topic looks like a ticker question
const symbolMatch = topic.toUpperCase().match(/\b([A-Z]{2,5})\b/);
const symbol = symbolMatch ? symbolMatch[1] : null;

// Step 3: paid data via x402 (free-trial quota covers first calls)
console.log("2/4 x402 sentiment ($0.03) — news sentiment score...");
const sentiment = symbol ? await x402Call("/sentiment/api/sentiment", { method: "POST", body: { query: symbol } }) : null;

console.log("3/4 x402 sbscore ($0.05) — AI asset score...");
const score = symbol ? await x402Call("/sbscore/api/score", { method: "POST", body: { symbol } }) : null;

console.log("4/4 x402 researchmemo ($0.10) — AI investment memo...");
const memo = symbol ? await x402Call("/researchmemo/api/memo", { method: "POST", body: { symbol, query: topic } }) : null;

// Step 4: brief
console.log("\n" + "=".repeat(60));
console.log("📋 DECISION BRIEF");
console.log("=".repeat(60));
if (webContext.length) {
  console.log("\n🌐 Web context (TinyFish, free):");
  webContext.forEach((w) => console.log("  " + w));
}
if (sentiment && !sentiment._needsPayment) {
  console.log(`\n📊 Sentiment: ${sentiment.score ?? "n/a"}/±100`);
}
if (score && !score._needsPayment) {
  console.log(`🤖 AI score: ${score.score ?? "n/a"}/100`);
}
if (memo && !memo._needsPayment) {
  console.log(`\n📝 Memo thesis: ${(memo.thesis || JSON.stringify(memo)).slice(0, 400)}`);
}
for (const [name, r] of [["sentiment", sentiment], ["sbscore", score], ["memo", memo]]) {
  if (r?._needsPayment) console.log(`\n💳 ${name}: needs payment (${r.price}) — free trial exhausted, pay via x402 to unlock`);
}
console.log("\nDone. TinyFish gave you the web; x402 gave you the DATA.\n");
