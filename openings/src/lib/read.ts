import { tinyfish } from "./tinyfish";

export interface PageRead {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
}

const BATCH = 10; // Fetch API max URLs per request

/** TinyFish Fetch: read posting pages in parallel batches of 10. Failed URLs are dropped. */
export async function readPages(urls: string[], ttlSeconds = 3600): Promise<PageRead[]> {
  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += BATCH) batches.push(urls.slice(i, i + BATCH));

  const responses = await Promise.allSettled(
    batches.map((batch) =>
      tinyfish().fetch.getContents({
        urls: batch,
        format: "markdown",
        ttl: ttlSeconds,
        per_url_timeout_ms: 45_000,
        purpose: "Read a job posting: title, location, pay, dates, requirements, visa sponsorship",
      }),
    ),
  );

  const out: PageRead[] = [];
  for (const r of responses) {
    if (r.status !== "fulfilled") continue;
    for (const res of r.value.results) {
      // Some JS-rendered boards (e.g. Ashby) put the body in `description` and leave `text` empty.
      const text = typeof res.text === "string" && res.text.trim() ? res.text : (res.description ?? "");
      if (!text) continue;
      out.push({ url: res.url, finalUrl: res.final_url ?? res.url, title: res.title ?? "", text });
    }
  }
  return out;
}
