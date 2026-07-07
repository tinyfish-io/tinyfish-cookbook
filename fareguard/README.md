# FareGuard

Corporate travel cost control — live fare and demand tracking across Vietnam airline and OTA portals, for a company's travel/finance team (not individual travelers).
**Live Link - ** https://fareguard.vercel.app/

## How it actually works (important — read this part)

The real scraping does **not** run on Vercel. A 7-site TinyFish sweep can take longer than Vercel's function time limit (60s on Hobby), so the heavy lifting runs on a free **GitHub Actions** schedule instead:

```
GitHub Actions (every 8 hours)
  → scripts/sweep.ts
  → calls TinyFish for all 7 sites in parallel
  → then always calls Groq for fresh recommendations
  → writes everything straight to Redis

Vercel (your deployed site)
  → only ever reads from Redis
  → never scrapes on page load — opening the dashboard never
    triggers a sweep, only the schedule (or a manual trigger) does
  → "Run sweep now" button asks GitHub to run the workflow immediately
    instead of running it itself
```

Locally (`npm run dev`), there's no Vercel time limit at all, so the first time you ever run it with `TINYFISH_API_KEY` set, it fires one real sweep inline automatically. After that, it behaves like production — reads only, waiting on the schedule or the button.

## What it does

- 7 agents run in parallel, one per site (Vietjet, Vietnam Airlines, Bamboo Airways, Traveloka, Baolau, 12Bay, Skyscanner VN). Each one pulls fares for all 3 tracked routes.
  - 6 of them go through the **TinyFish Agent API** with stealth mode — real browser automation, since their search forms have no shareable deep-link URL.
  - **Skyscanner VN** goes through the **TinyFish Fetch API** instead — it has a documented, public deep-link format (`/transport/flights/{from}/{to}/{YYMMDD}/`), so the page already has the answer with no clicking needed. Free, faster, and the extracted text is parsed into a price by a quick Groq call.
- Routes tracked: Hanoi↔Ho Chi Minh City, Ho Chi Minh City↔Da Nang, Ho Chi Minh City↔Bangkok — searched for today's date (Vietnam time, UTC+7), one date per sweep, since the point of the 4-hourly cadence is watching the same date's price move, not scanning a range.
- Every sweep (every 8 hours), the full accumulated price history goes to Groq (Llama 3.3 70B) for a booking-window recommendation per route — runs side by side with the price scrape, no separate schedule to track. Falls back to a built-in heuristic if no Groq key is set.
- A "booking requests" tab lets a travel manager set a passenger, route, date, and threshold price. When the fare on the preferred site drops to that threshold, the status flips — for Vietjet specifically, this represents the agent having filled the booking form up to the final payment step (not yet wired to a real browser agent or payment — that's the next phase).

## Tech stack

- Next.js 14 (App Router) + TypeScript, Tailwind CSS with full light/dark theme support
- Recharts for the fare trend chart
- TinyFish Agent API (`agent.tinyfish.ai/v1/automation/run`) for the real scraping
- Groq (Llama 3.3 70B) for the daily fare analysis
- Redis (Upstash, via Vercel's Redis marketplace integration) for persistence — falls back to in-memory automatically if not configured, so local dev works without setup
- GitHub Actions for the actual scheduled sweep (no duration cap, unlike Vercel)

## Run locally

```bash
npm install
npm run dev
```

Works immediately with no env vars (synthetic seed data + heuristic recommendations). Add `TINYFISH_API_KEY` to `.env.local` to get one real sweep automatically on first load.

## Deploy

### 1. Push to GitHub
This is required regardless of where you host the site — the scraping schedule lives in GitHub Actions.

### 2. Set up Redis
Either via Vercel's Storage tab (Marketplace → Redis, which sets `KV_REST_API_URL`/`KV_REST_API_TOKEN` on your Vercel project automatically) or directly at upstash.com. Either way, copy those two values — you'll need them in **two places**.

### 3. Add GitHub repo secrets
Settings → Secrets and variables → Actions, add:
- `TINYFISH_API_KEY`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `GROQ_API_KEY` (optional, falls back to heuristic without it)

This is what `.github/workflows/sweep.yml` uses to run the real sweep every 8 hours.

### 4. Deploy the app to Vercel
Add these env vars on the Vercel project:
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — same values as the GitHub secrets, so the dashboard reads the same data the sweep writes
- `TINYFISH_API_KEY` — only needed here so the dashboard's "simulated vs live" badge displays correctly
- `GROQ_API_KEY` — optional
- `CRON_SECRET` — any random string, protects the POST endpoints from random requests
- `GITHUB_TOKEN` — a GitHub personal access token with `workflow` scope (Settings → Developer settings → Personal access tokens), lets the "Run sweep now" button trigger the Action remotely
- `GITHUB_REPO` — e.g. `yourname/fareguard`

### 5. Confirm the schedule
`.github/workflows/sweep.yml` runs every 8 hours automatically once pushed to GitHub — no extra setup needed beyond the secrets in step 3. You can also trigger it manually from the repo's Actions tab, or via the dashboard's "Run sweep now" button once Vercel is deployed.

## Wiring in real booking automation

`lib/agents.ts` already calls the real TinyFish Agent API for price tracking. The booking-request "fill the form to the final payment step" flow is still simulated (`lib/booking.ts` just flips a status when the threshold is crossed) — that's the next phase, and would use the same TinyFish Agent API with a goal describing the actual booking flow, stopping before the payment step.
