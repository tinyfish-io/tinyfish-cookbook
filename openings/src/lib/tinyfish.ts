import { TinyFish } from "@tiny-fish/sdk";

let client: TinyFish | null = null;

/** Server-only TinyFish client. Reads TINYFISH_API_KEY from the environment. */
export function tinyfish(): TinyFish {
  if (!process.env.TINYFISH_API_KEY) {
    throw new Error("Missing TINYFISH_API_KEY");
  }
  client ??= new TinyFish();
  return client;
}

interface RawFetchResult {
  url: string;
  text: string | null;
}

/**
 * Direct Fetch API call for options the SDK doesn't expose yet (e.g. `include_selectors`,
 * missing in @tiny-fish/sdk 0.7.0). Same endpoint and auth as the SDK.
 */
export async function fetchRaw(body: Record<string, unknown>): Promise<{ results: RawFetchResult[] }> {
  const res = await fetch("https://api.fetch.tinyfish.ai", {
    method: "POST",
    headers: { "X-API-Key": process.env.TINYFISH_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(150_000),
  });
  if (!res.ok) throw new Error(`TinyFish Fetch ${res.status}`);
  return res.json();
}
