# Live validation record

Validated on **2026-10-16 UTC** using the authenticated TinyFish Search and Fetch **browser playgrounds**. The Python helper processed the exact captured responses. These results do not claim that its REST network adapter was exercised live.

## Successful default-provider cases

| Preferences | Employer | Verified role | Capture time (UTC) |
|---|---|---|---|
| Software engineer · New York · Python | New York ISO | Senior Software Engineer (Python) | 04:43:43 |
| Software engineer · New York · Python | Hudson River Trading | Software Engineer (C++ or Python) – 2027 Grads | 04:44:34 |
| Product designer · London · Figma | Figma | Product Designer, Roundtripping (London, United Kingdom) | 04:45:18 |
| Product designer · London · Figma | SumUp | Senior Product Designer | 04:45:18 |

Each published HTML/JSON report contains two matches across two employers, status `ok`, mode `playground_capture`, application links, exact source URLs and timestamps, short evidence, and explicit missing fields. New York is a literal location-string match and includes Rensselaer in New York State; it is not silently interpreted as NYC-only.

Raw complete captures were independently compared against all four published records: job ID, role, employer, structured location, apply URL, dates, and observed time agree. Public exports contain normalized job fields and short excerpts, not complete provider responses, credentials, account screens, or applicant data.

## Actual endpoint use

- TinyFish Search found the employer postings from role/location/keyword queries
- TinyFish Fetch retrieved the individual public posting records, with `format: markdown` and `ttl: 0`
- The helper recovered invalid Markdown-only punctuation escapes from otherwise complete JSON; no partial/truncated document was reconstructed
- `ttl=0` is a freshness preference. Origin caching can still serve older content; later job closure is possible
- No TinyFish Agent or Browser endpoint was used; the project claims two meaningful endpoints

The entire development validation pass made **17 TinyFish requests: 6 Search + 11 Fetch requests covering 12 fetched URLs**. The final default-provider demos use the successful Greenhouse subset of those genuine captures. Extra exploratory calls and failures are disclosed below rather than counted as additional product capability.

## Failed and unattempted experimental paths

- A full NYISO board preview and the HelloPatient Ashby preview exceeded the playground's 100,000-character display limit. They were recorded as capture limitations and never imported as complete JSON
- Revin JSON/HTML formats, Ro, Ladders, Palantir, and Quantum produced transformed content without a reliably recoverable structured feed. Their adapters therefore returned parse errors
- Kpler and Sequence targets were discovered but not fetched after the validation scope was frozen
- Greenhouse became the default based on observed results. Lever and Ashby remain explicit experimental opt-ins, covered by schema-level synthetic tests, not a claim of successful live extraction

## Offline and packaging checks

- **99 tests passed**, including 336 malformed optional-field subcases, with no network or secrets
- Python bytecode compilation passed
- Skill frontmatter/name validation passed
- Capture audit whitelisting excludes imported headers, API keys, token fields, nested metadata, and unsafe URL values
- The GIF is a **rendered walkthrough of executed Skill output using TinyFish playground captures**, not a browser recording. All four frames were visually inspected
- HTML files are self-contained, script-free, escaped reports. No hosted live web app is claimed; browser pixel QA was unavailable in the validation environment

## Refreshing the demo

Run the direct REST command with a securely configured TinyFish environment key, or follow [the authenticated capture workflow](../references/transports.md). These are current-data runs, so results can change. To reproduce the demonstrated narrow scope, use `--max-boards 2`; Greenhouse is the default.

```bash
python3 scripts/careers.py --role 'software engineer' --location 'New York' \
  --keyword Python --max-boards 2

python3 scripts/careers.py --role 'product designer' --location London \
  --keyword Figma --country GB --max-boards 2
```

For a completely offline demonstration, use the explicitly fictional fixture. It does not validate live service access or vacancies.
