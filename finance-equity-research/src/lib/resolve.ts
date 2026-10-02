import { searchWeb } from "./tinyfish";
import type { SourceProfile } from "./sources";

// Resolve a ticker into a source profile: where its customers, employees, and
// filings live. Seeded companies skip this; arbitrary tickers go through it.

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

export async function resolveCompany(ticker: string): Promise<{ name: string; exchange: string | null; profile: SourceProfile } | null> {
  const upper = ticker.toUpperCase();

  // SEC's official ticker → CIK map: free, exact, no scraping.
  const cikEntry = await lookupCik(upper);
  if (!cikEntry) return null;

  const [social, apps, careers] = await Promise.all([
    searchWeb(`${cikEntry.title} subreddit reddit community customers`),
    searchWeb(`${cikEntry.title} mobile app "app store" OR "google play"`),
    searchWeb(`${cikEntry.title} careers jobs site:greenhouse.io OR site:lever.co OR careers`),
  ]);

  const searchDigest = [social, apps, careers]
    .flatMap((r) => r.results.slice(0, 6).map((x) => `${x.title} — ${x.url} — ${x.snippet ?? ""}`))
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `From these web search results about ${cikEntry.title} (${upper}), assemble a source profile. STRICT JSON:
{"subreddits":["names without r/ prefix, company-specific first"],"trustpilotDomain":"domain.com or null","appStoreUrl":"apps.apple.com url or null","googlePlayUrl":"play.google.com url or null","careersUrl":"url or null","atsBoard":{"kind":"greenhouse|lever","slug":"board slug"} or null,"newsroomUrl":"url or null","downdetectorSlug":"slug or null","companyDomain":"primary domain"}
Only include values actually evidenced by the results; null otherwise.`,
        },
        { role: "user", content: searchDigest },
      ],
    }),
  });
  if (!response.ok) throw new Error(`resolveCompany: OpenAI ${response.status}`);
  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  const raw = JSON.parse(data.choices[0].message.content) as SourceProfile & { subreddits?: string[] };

  const profile: SourceProfile = {
    ...raw,
    edgarCik: String(cikEntry.cik),
    subreddits: raw.subreddits?.slice(0, 2),
  };
  return { name: cikEntry.title, exchange: null, profile };
}

async function lookupCik(ticker: string): Promise<{ cik: number; title: string } | null> {
  const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": "Upstream research demo contact@tinyfish.ai" },
    cache: "force-cache",
  });
  if (!response.ok) throw new Error(`lookupCik: SEC returned ${response.status}`);
  const map = (await response.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
  for (const entry of Object.values(map)) {
    if (entry.ticker === ticker) return { cik: entry.cik_str, title: entry.title };
  }
  return null;
}
