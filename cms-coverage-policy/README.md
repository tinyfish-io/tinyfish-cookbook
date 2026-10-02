# Coverage Atlas — 50-state CMS coverage policy, verified live

Medicare and Medicaid coverage rules are set state by state; the same drug can be covered in one state, restricted next door, and gone by summer. No public tool shows the whole picture. Coverage Atlas scans all 51 jurisdictions with TinyFish agents, keeps every record's verification timestamp honest, and makes the comparison and the delta — not the data — the product.

**The signature:** the freshness chip. Every record shows "Checked today, 9:14 AM," and a **Check again now** button dispatches a live agent to re-read the official source on the spot. In testing, the agent corrected our own database live (North Carolina: covered → covered with limits, prior auth required).

## Screens

- **Coverage map** — 51-state tile grid per condition (GLP-1 for obesity, CGMs), colored by status; **Sweep all 51 states now** streams a full re-check over SSE (~25s), repainting tiles as each state lands.
- **What changed** — a plain-language timeline of the year's policy changes, each with before→after chips and the official source.
- **Compare states** — SC vs TX prior-auth criteria row by row, plain words first, exact policy wording expandable underneath.

## How it uses TinyFish

The sweep does one **fetch** of the authoritative tracker plus one live **search** per state for corroboration; per-state verification uses a stealth **agent** (state sites 403 plain fetchers — live-tested):

```ts
// src/app/api/verify/route.ts
const stream = await client.agent.stream({
  url: record.source_url,
  goal: `Find what this page says about ${stateName}'s Medicaid coverage of ${record.condition_name}.
         Return STRICT JSON: {"status":"covered|limits|prior|not|none","note":"...","found":true|false}. Never guess.`,
  browser_profile: BrowserProfile.STEALTH,
  proxy_config: { enabled: true, country_code: "US" },
});
```

Statuses are never hand-typed: the seed itself scrapes the trackers (RX Index, T1D Exchange) through TinyFish fetch and normalizes with an LLM under a no-guessing contract. Sweeps pass the current statuses back in with a hysteresis rule — borderline judgment calls keep the current status, so a reported change is a real alert, not classifier noise.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in keys
node scripts/apply-schema.mjs
node scripts/seed.mjs        # live-scrapes the trackers into 51-state records
npm run dev
```

Raw Postgres over the Supabase session pooler; env vars in `.env.example`; design system in `docs/DESIGN.md` (locked from a Claude Design handoff in `docs/design-handoff/`).
