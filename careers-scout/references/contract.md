# Data contract and evidence

## Provider adapters

Greenhouse is the default, live-validated provider. Lever and Ashby are explicit experimental opt-ins: their field mappings pass synthetic tests, but the live TinyFish playground transformed the tested feeds into non-JSON text. Those responses are rejected, not silently interpreted as structured records.

| Provider | Search discovery hosts | Feed retrieved through TinyFish Fetch |
|---|---|---|
| Greenhouse | `job-boards.greenhouse.io`, `boards.greenhouse.io` | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` |
| Lever | `jobs.lever.co`, `jobs.eu.lever.co` | `https://api.lever.co/v0/postings/{site}?mode=json&limit=100&skip=0` (EU: `api.eu.lever.co`) |
| Ashby | `jobs.ashbyhq.com` | `https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` |

When Search finds a direct Greenhouse or Lever posting URL, the helper derives that posting’s individual public API endpoint. It prefers one role-relevant posting per employer to keep retrieval small. Board-root results fall back to the list endpoints above. Search results supply discovery URLs, never job facts. Only a successfully fetched, recognized posting feed can create a job record. All job facts come from explicit feed fields. We do not scrape a search snippet and call it a verified vacancy.

## Field mapping

- Greenhouse: `title`, `absolute_url`, `location.name`, HTML-decoded `content`, `updated_at`. Current feeds may also provide `company_name` and `first_published`; absent values remain null
- Lever: `text` is title, `applyUrl`/`hostedUrl` are application/detail links, `categories.location` + `allLocations` are locations, `workplaceType` is work mode, `commitment` is employment type. Searchable description combines `descriptionPlain`, lists, and `additionalPlain`; `salaryRange` is preserved if present
- Ashby: `title`, `applyUrl`/`jobUrl`, `location` + `secondaryLocations`, `address.postalAddress`, `workplaceType`/`isRemote`, `employmentType`, `publishedAt`, and `compensation`. `isListed: false` postings are excluded
- Company names are not title-cased from a URL. `employer_board` always preserves the actual board identifier; `company` is null unless an explicit company-name field exists
- Unknown work mode is null. Remote is inferred only from an explicit `isRemote`, recognized `workplaceType`, or the structured location's remote label, never a sentence like “this is not a remote position” in a description
- Job availability means “listed on public board when observed,” not a guarantee that applications remain open. Salary is unmodified provider data, not normalized across currencies, periods, or benefits

## Filtering and ranking

Hard filters: every token of at least one requested role must occur in the title; a supplied location must occur in the structured location fields; a requested work mode must be explicit; excluded phrases must not occur in title/description. Keywords become mandatory only with `--require-keywords`.

Score: 50 for a role-title match, +15 for an exact role phrase, +15 for the specified location, +10 for a confirmed requested work mode, +8 for each matched keyword (maximum 24), capped at 100. Ties sort deterministically by title, employer board, then canonical job URL. This is a transparent preference heuristic, not an assessment of applicant eligibility or employability.

Deduplication runs after preference filtering and score ordering, so a matching representation is not lost to a nonmatching duplicate. Identity is the same provider/region/board/posting ID or the same canonical job URL. Fragments and known tracking parameters are removed; identity-bearing query parameters are retained. Lever's `/apply` suffix maps to its detail URL. Greenhouse's legacy board hostname maps to the current hostname. No fuzzy merge by title: two genuinely distinct jobs at one employer may share a title.

## Output

The JSON contains preferences, generated time, transport mode, ranked jobs, discovered sources, source retrieval time and freshness, request audit, partial errors, and coverage/rejection counts. Every job has `apply_url`, `canonical_job_url`, `source_board_url`, `source_feed_url`, `observed_at`, and `match_reasons`.

Expired explicit application deadlines are rejected; no expiration is inferred from prose.

`live` means the helper called the REST endpoints. `mcp_capture`/`playground_capture` means it processed actual responses captured by the host. `fixture` means synthetic test data. These labels are never interchangeable.

## Deliberate limits

- Only these three public ATS families are supported; arbitrary Workday/custom careers pages are not guessed or silently added
- ASCII board tokens with letters, numbers, hyphens, and underscores are supported. Unusual encoded board names are skipped, not guessed
- At most ten employers; defaults to six. When multiple providers are explicitly enabled, selection is round-robin across their search results. This is discovery sampling, not complete indexing
- Lever returns at most its first 100 postings in this bounded recipe. A full page creates a coverage warning instead of claiming completeness
- Location matching is literal and case-insensitive. “New York” does not match “NYC”; unknown locations are excluded if location is required. No geographic, visa, sponsorship, relocation, or worldwide-remote assumptions
- Search engines can miss boards; postings may close immediately after retrieval; a later run can change results
- The helper never invokes TinyFish Agent, submits an application, or collects personal applicant data

## Current official references

Verified 2026-10-16; recheck these if an API changes:

- [TinyFish Search API](https://docs.tinyfish.ai/search-api/reference)
- [TinyFish Fetch API](https://docs.tinyfish.ai/fetch-api/reference): documents JSON origins as raw JSON text, but live validation found rendering exceptions; cleaned HTML is not a reliable source of embedded JSON-LD
- [TinyFish MCP integration](https://docs.tinyfish.ai/mcp-integration)
- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Lever public postings API](https://github.com/lever/postings-api)
- [Ashby public job posting API](https://developers.ashbyhq.com/docs/public-job-posting-api)

TinyFish currently documents 12,000 free Search requests/day and 1,000 successful Fetch URLs/day, with wallet-dependent behavior beyond those allowances. This recipe makes a bounded number of calls but cannot know an account's remaining quota. Check account usage before a live demo; do not automatically top up or add a paid endpoint.
