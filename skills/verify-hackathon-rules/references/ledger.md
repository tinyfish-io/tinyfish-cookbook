# Ledger schema and interpretation contract

Create claims separately; never edit a live snapshot to make a quote match.

```json
{
  "schema_version": 1,
  "event": "Example Sprint 2026 — student track",
  "claims": [
    {
      "id": "submission-deadline",
      "kind": "deadline",
      "value": {"local": "2026-10-15T23:59", "zone": "America/Los_Angeles"},
      "evidence": [{"source_id": "s1", "quote": "Submissions close October 15, 2026 at 11:59 PM US Pacific Time."}]
    },
    {
      "id": "student-status",
      "kind": "eligibility",
      "value": "Currently enrolled college students only.",
      "evidence": [{"source_id": "s1", "quote": "Participants must be currently enrolled college students."}]
    },
    {
      "id": "required-repository",
      "kind": "deliverable",
      "value": "Provide a public repository link.",
      "evidence": [{"source_id": "s1", "quote": "Submit a public repository link and a two-minute demo video."}]
    },
    {"id": "team-size", "kind": "eligibility", "value": null, "evidence": []}
  ]
}
```

This is synthetic, not a real announcement. The demo requirement needs its own claim even
when it cites the same passage. Check semantic support manually: the helper matches exact
quote bytes and checks hashes/time arithmetic; it does not judge entailment with an LLM.
Titles, snippets and publication dates do not prove deadlines. Never guess absent facts.

Represent conflicting versions as claims with the same ID, different values, and their own
evidence. Equivalent deadline instants in different IANA zones do not conflict. Prose uses
conservative exact comparison; rephrasing can produce a false positive. Different IDs are
not compared semantically. Use the full condition, not unrelated matching words.

Snapshot fields: `schema_version`, `mode` (`live`/`fixture`), `created_at`, `allowed_domains`,
`requested_urls`, `api_requests`, `candidates`, `sources`, `errors`. Each source contains
`id`, requested `url`, `final_url`, `title`, full `text`, exact UTF-8 SHA-256 and `fetched_at`.
Mode is local metadata, not cryptographic proof of API use. Preserve actual collection logs.

Limits: 10 URLs, one optional search, 3 attempts/endpoint, 8 MiB response cap, 150-second HTTP
timeout, 45-second per-URL requested timeout, 30-second maximum retry delay. No retries for
transport failures, auth/quota errors, per-URL failures, login walls or bot blocks. `429` and
transient server errors use bounded backoff with Retry-After. API redirects are refused to
keep credentials on the fixed TinyFish hosts.

TinyFish receives public URLs and the query. Exclude private/signed URLs, secrets and profile
details. Local/private literals are rejected, but TinyFish's SSRF controls remain responsible
for DNS resolution and target redirects. Exact-domain validation is not authority verification.

Official references:
- https://github.com/tinyfish-io/tinyfish-cookbook/tree/main/skills/use-tinyfish
- https://docs.tinyfish.ai/search-api/reference
- https://docs.tinyfish.ai/fetch-api/reference
