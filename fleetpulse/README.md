# FleetPulse

Fleet cost intelligence for Vietnam vehicle fleets, built around TASCO's own ecosystem (VETC tolls, Tasco Auto service centers) — tracks real fuel, toll, and competitor pricing, and automates the first draft of a service-booking request when a vehicle passes its maintenance interval.

## How it works

```
GitHub Actions (daily, 9:00 AM Vietnam time)
  → scripts/sweep.ts
  → 3 TinyFish agents in parallel: Petrolimex (fuel), VETC (tolls),
    Grab (competitor fare benchmark)
  → writes to Redis progressively, one source at a time
  → auto-flags and auto-drafts a service request for any vehicle
    that's now past its service interval

Vercel (your deployed site)
  → only ever reads from Redis
  → opening the dashboard never triggers a sweep
  → "Check costs now" dispatches the GitHub Actions workflow
```

## Why these 3 sources (kept to one link per information type, on request, to keep sweeps fast)

- **Petrolimex** — Vietnam's dominant, government-price-regulated fuel retailer.
- **VETC** — Tasco's own electronic toll subsidiary; toll fee tracked for the real Hanoi–Hai Phong Expressway (CT04), a genuine logistics corridor.
- **Grab** — dominant ride-hailing app, used as a single competitive fare benchmark (Noi Bai Airport → Hanoi Old Quarter, a well-known reference route). Be was considered and dropped to keep the sweep to one agent per cost type.

## Vehicles and service requests

2 vehicles seeded for testing — one already past its service interval (guarantees a real request to test), one well within it. Mileage is simulated (no real fleet telemetry to read from); everything else — the cost data, the Groq-drafted request — is real.

The Tasco Auto service-booking form is a **fixed, hand-built template**, not scraped — same pragmatic call made for MarketPulse's supplier RFQs and RateRadar's bank applications. "Apply for service" lets you manually trigger a request for any vehicle regardless of mileage.

## Tech stack

Next.js 14 (App Router) + TypeScript, Tailwind CSS, Roboto Slab (serif) + Inter (body). TinyFish Agent API for cost tracking. Groq for service-request drafting. Redis (Upstash) for persistence, falling back to a local file automatically when not configured. GitHub Actions for the daily sweep.

## Run locally

```bash
npm install
npm run dev
```

Add `TINYFISH_API_KEY` to `.env.local` for a real sweep automatically on first load.

## Deploy

Same pattern as the rest of this app family:
1. Push to its own GitHub repo
2. Set up Redis (Upstash — copy `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` exactly)
3. Add repo secrets: `TINYFISH_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GROQ_API_KEY`
4. Deploy on Vercel with the same 4 plus `CRON_SECRET`, `GITHUB_TOKEN` (personal access token, `workflow` scope), `GITHUB_REPO`
5. Trigger `.github/workflows/sweep.yml` manually once from the Actions tab to confirm before waiting for the schedule
