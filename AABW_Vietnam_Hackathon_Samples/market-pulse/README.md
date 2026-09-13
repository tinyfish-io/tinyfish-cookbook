# MarketPulse

Retail intelligence for a Vietnam electronics retailer — tracks 5 real competitors' laptop and PC component pricing/stock daily, and automates the first draft of restock requests when our own stock runs low.
**Live Link - ** https://marketpulse-gray.vercel.app/

## How it works

```
GitHub Actions (daily, 8:00 AM Vietnam time)
  → scripts/sweep.ts
  → 5 TinyFish agents in parallel: The Gioi Di Dong, FPT Shop,
    CellphoneS, Nguyen Kim, Gear.vn
  → each searches for our tracked laptops/PC components and records
    real price + stock status
  → writes to Redis progressively, one site at a time
  → auto-flags any of our products below its stock threshold

Vercel (your deployed site)
  → only ever reads from Redis
  → opening the dashboard never triggers a sweep
  → "Run sweep now" dispatches the GitHub Actions workflow
```

Our own price/stock data is **simulated**, not scraped — there's no real access to a real internal inventory system. It's seeded realistically, with one product (Acer Nitro 5) deliberately kept low so there's always a live restock case to test.

## The restock flow

1. **Flagged** — a product drops below its stock threshold, automatically, after any sweep.
2. **Draft with AI** — Groq fills in a fixed supplier form template (Synnex FPT for laptops, Petrosetco for PC components) using the real competitor pricing/stock context and the reason it was flagged. Never invents numbers — if data's missing, it says so factually rather than guessing.
3. **Ready for review** — every answer is editable before anything is finalized.
4. **Submit** — completes the request. Not yet wired to send to a real external supplier system, but the entire draft → review → submit loop is real and complete.

Supplier RFQ forms are **fixed, hand-built templates**, not scraped — these B2B relationships use standard forms in practice, so there was no reason to add scraping risk there.

## Sources

- **The Gioi Di Dong, FPT Shop, CellphoneS, Nguyen Kim, Gear.vn** — real, confirmed competitors in the Vietnam laptop/PC market, scraped via TinyFish Agent.
- **Synnex FPT, Digiworld, Petrosetco** — real Vietnam IT distributors, used only as the supplier identity on fixed form templates — never scraped.

## Tech stack

Next.js 14 (App Router) + TypeScript, Tailwind CSS, Fraunces (serif) + Inter (body) fonts. TinyFish Agent API for competitor scraping. Groq for restock drafting. Redis (Upstash) for persistence, falling back to a local file automatically when not configured. GitHub Actions for the daily sweep (no Vercel duration cap). Recharts for the pricing comparison chart.

## Run locally

```bash
npm install
npm run dev
```

Works with no env vars (seed data only). Add `TINYFISH_API_KEY` to `.env.local` for one real sweep automatically on first load.

## Deploy

Same pattern as FareGuard and Founder Mode:
1. Push to its own GitHub repo
2. Set up Redis (Upstash, via Vercel's Storage → Marketplace → Redis, or directly — copy the REST URL/TOKEN exactly, no quotes, no trailing whitespace — though the code now trims this defensively regardless)
3. Add repo secrets: `TINYFISH_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `GROQ_API_KEY`
4. Deploy on Vercel with the same 4 plus `CRON_SECRET`, `GITHUB_TOKEN` (personal access token, `workflow` scope), `GITHUB_REPO`
5. Trigger `.github/workflows/sweep.yml` manually once from the Actions tab to confirm before waiting for the schedule
