# PropertyPulse

Real estate market intelligence for agencies — tracks live listings across 5 real Vietnam property portals for whichever areas you add, on behalf of your clients.
**Live Link - ** https://propertypulse-jet-eight.vercel.app/

## How it works

```
GitHub Actions (daily, 11:30 AM Vietnam time)
  → scripts/sweep.ts
  → only actually processes searches where 48+ hours have passed
    since their last check (or that have never been checked)
  → 5 TinyFish agents in parallel: Batdongsan.com.vn, Nha Tot,
    Alonhadat, Homedy, Cafeland
  → each finds up to 3 real matching listings per due search
  → writes to Redis progressively, one portal at a time

Vercel (your deployed site)
  → only ever reads from Redis
  → opening the dashboard never triggers a sweep
  → adding a new search dispatches GitHub Actions for an immediate
    one-time check of just that search
  → "Check now" on a search's detail page force-checks it regardless
    of the 48h gate
```

## Why a daily cron for a 48h cadence

GitHub Actions cron doesn't cleanly express "every 2 days" — so instead, the workflow fires every day, and the sweep logic itself only processes searches that are actually due. Same real-world result (every search gets checked roughly every 48h), simpler and more reliable than fighting cron syntax.

## Sources

**Batdongsan.com.vn, Nha Tot, Alonhadat, Homedy, Cafeland** — confirmed via research to be the 5 largest, currently active property portals in Vietnam (Batdongsan.com.vn is the dominant #1 site; the rest are its most-cited real competitors).

**Deliberately not doing:** showing actual photos scraped from listings — that's directly reproducing another party's copyrighted photography, a meaningfully different risk than facts like price or floor area. Listings show as text only (title, price, size, bedrooms, and a link to the real listing).

## Tech stack

Next.js 14 (App Router) + TypeScript, Tailwind CSS, Playfair Display (serif) + Inter (body). TinyFish Agent API for portal scraping. Redis (Upstash) for persistence, falling back to a local file automatically when not configured. GitHub Actions for the scheduled sweep (no Vercel duration cap).

## Run locally

```bash
npm install
npm run dev
```

Works with no env vars (one example tracked search seeded, empty listings). Add `TINYFISH_API_KEY` to `.env.local` for a real sweep of any never-checked search automatically on first load.

## Deploy

Same pattern as the other apps in this series:
1. Push to its own GitHub repo
2. Set up Redis (Upstash — copy `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` exactly, no quotes; the code trims defensively regardless)
3. Add repo secrets: `TINYFISH_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
4. Deploy on Vercel with the same 3 plus `CRON_SECRET`, `GITHUB_TOKEN` (personal access token, `workflow` scope), `GITHUB_REPO`
5. Trigger `.github/workflows/sweep.yml` manually once from the Actions tab to confirm it works before waiting for the schedule
