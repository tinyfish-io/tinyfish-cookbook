# REST, MCP, and playground transports

## Direct REST

Set `TINYFISH_API_KEY` through the host's approved environment-secret mechanism. The script sends that key only in `X-API-Key` to the fixed official Search/Fetch origins. HTTP redirects are rejected. It does not read `.env` files, use a second LLM key, print server error bodies, or store credentials.

One default run makes one Greenhouse-scoped Search request and one Fetch batch of at most six employer posting records. Explicitly enabling all three providers makes three Search requests. Search returns discovery evidence; Fetch requests raw JSON origin URLs with `format: markdown`, `ttl: 0`. TinyFish documentation describes JSON origins as raw JSON in `results[].text`; live validation found some rendered responses instead escape Markdown or discard the JSON structure. The helper can losslessly remove invalid Markdown punctuation escapes from otherwise complete JSON. It rejects prose-only or truncated responses rather than reconstructing missing fields. `format: json` can be a document tree and does not guarantee an original JSON feed.

Transient HTTP 429/5xx failures get at most two retries with 15/30-second backoff. Network failures also get at most two retries. Authentication, allowance, and permission errors stop further network work. The JSON audit records endpoint, sanitized request, timestamp, status, and response hash, never the API key.

## Authenticated MCP or browser playground

Use the already connected TinyFish tools, or the already signed-in TinyFish playground in an authorized browser. These are first-class alternatives when the execution environment lacks an API key. The browser/tool performs live retrieval; the helper processes the captured response. The helper does not itself authenticate or launch a browser.

1. Emit the exact Search request(s) (no credentials or network required):

```bash
python3 scripts/careers.py --role 'software engineer' --location 'New York' \
  --keyword Python --plan
```

2. Run each query through TinyFish Search. Preserve its `results` envelope in `capture.json`. Use `transport: tinyfish-mcp` or `tinyfish-playground` to identify what actually executed. For MCP, record the actual tool name in `source`; for the playground, record its verified URL. Use actual timezone-aware completion timestamps. The initial file can have an empty `fetch` array.

```json
{
  "transport": "tinyfish-playground",
  "search": [
    {
      "query": "EXACT query emitted by --plan",
      "captured_at": "2026-10-16T04:40:00Z",
      "source": "https://agent.tinyfish.ai/playground/search",
      "response": {"results": []}
    }
  ],
  "fetch": []
}
```

This is the file shape, not sample live evidence. Replace the empty results with the complete genuine response. Do not invent a result, timestamp, or tool execution.

3. Select safe public posting feeds from the captured discovery:

```bash
python3 scripts/careers.py --role 'software engineer' --location 'New York' \
  --keyword Python --capture capture.json --prepare-fetch --json output/fetch-plan.json
```

4. Run the emitted `fetch_request` through TinyFish Fetch. Request `ttl=0` if the tool/playground exposes it. Add each batch to the `fetch` array:

```json
{
  "urls": ["EXACT requested feed URL"],
  "request": {"urls": ["EXACT requested feed URL"], "format": "markdown", "ttl": 0},
  "captured_at": "2026-10-16T04:42:00Z",
  "source": "https://agent.tinyfish.ai/playground/fetch",
  "response": {"results": [], "errors": []}
}
```

Preserve `response.results[].url`, `final_url`, and `text` exactly, plus `errors`. If the tool wraps a JSON object in a text content block, parse that JSON without paraphrasing it. If a playground truncates its response preview, never import it as complete JSON. Record an observed limitation separately in top-level `capture_issues`: an array of `{url, captured_at, source, error: "playground_preview_truncated"}`. This is a capture limitation, not a fabricated TinyFish API error.

If freshness cannot be set, omit `ttl` from the recorded request; the report then says `cache_status_unknown`. A numeric zero records `ttl_zero_requested`, not guaranteed origin freshness. Never assert a setting that was not used.

5. Produce the shortlist with exactly the same preferences:

```bash
python3 scripts/careers.py --role 'software engineer' --location 'New York' \
  --keyword Python --capture capture.json --json output/jobs.json --html output/jobs.html
```

The result mode is `mcp_capture` or `playground_capture`, not `live` REST. Source timestamps come from the actual captures. Capture imports cannot authenticate their own origin, so retain the original tool/browser evidence and do not treat arbitrary files as verified live data. This workflow does not test the Python network adapter.

## Synthetic offline mode

```bash
python3 scripts/careers.py --role 'software engineer' --location 'New York' \
  --keyword Python --fixture examples/synthetic.json
```

The CLI, JSON, and HTML all label this `fixture` / synthetic. No network request occurs. It tests the experience, not current job availability or TinyFish authentication.

## Exit status

- `0`: verified matches processed, including partial-source success
- `2`: execution/configuration failure or no readable employer boards
- `3`: boards were read but no jobs met the required preferences

Always inspect the report's errors and coverage; exit zero does not imply complete coverage.
