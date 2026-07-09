# RateRadar

**Compare live loan rates and savings yields across Vietnam's banks, with Shinhan Bank featured — then auto-fill applications at every bank in parallel, stopping just short of submitting.**

Built for the Financial Services track of Agentic AI Build Week ([aabw.genaifund.ai](https://aabw.genaifund.ai/)), sponsored by **Shinhan Bank / Shinhan Future's Lab Vietnam**.
**Live Link - ** https://rateradar-teal.vercel.app/

---

## A framing note

Financial Services is officially an enterprise track (the end user is meant to be a business team, not an individual). This build is intentionally consumer-facing instead, because that's what the literal brief describes: a rate comparison tool with parallel auto-apply. The honest defense for judges: this is Shinhan's customer-acquisition and rate-transparency play — Shinhan is the featured, sponsor-anchored bank in every comparison, and the tool exists to capture a shopper's attention and data at the exact moment they're rate-shopping.

---

## What it does

1. **Pick a product** — a 12-month savings deposit, a home loan, or a personal loan
2. **See live rates** across Shinhan Bank and 5 real competitors (Vietcombank, Techcombank, VPBank, BIDV, MB Bank), sorted best-first — savings compares highest APY, loans compare lowest interest rate
3. **Enter your details once** — name, amount, tenure
4. **Auto-fill applications at every bank in parallel** — one real-time TinyFish agent per bank, filling that bank's actual application/inquiry form with your details
5. **Review and submit yourself** — the agent stops before the final submit step on every bank's site. It never completes a binding financial application on your behalf; you get a direct link to each bank's form plus an estimated monthly payment/interest, and you finish it there

Shinhan's own rates come from an internal feed, never scraped — a bank already knows its own published rates.

---

## Architecture

```
.github/workflows/sweep.yml
  Daily cron, 07:00 UTC = 14:00 Vietnam time
        |
        v
scripts/sweep.ts  -->  POST /api/sweep (deployed app)
        |
        v
lib/sweep.ts: runSweep()
  1. internal.ts   -> Shinhan's own rates, NEVER scraped
  2. rates.ts (x5) -> real-time TinyFish agents, one per bank, all 3
                      products read in a single pass each
        |
        v
lib/storage.ts -> Upstash Redis (persists across requests/deploys)
        |
        v
GET /api/state (read-only, never triggers a sweep in production)
        |
        v
Dashboard: rate comparison + applicant form
        |
        v
POST /api/apply -> one TinyFish agent per bank fills the real
                    application form, stops before submit
        |
        v
Staged applications, reviewed and submitted by the person themselves
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Rate + form-fill agents | TinyFish Web Agent API (`@tiny-fish/sdk`, stealth profile, queue + poll) |
| Scheduling | GitHub Actions (daily cron, 14:00 Vietnam time) |
| Persistence | Upstash Redis (falls back to a local JSON file in dev) |
| Styling | Tailwind CSS |
| Deployment | Vercel |

## How to run locally

```bash
npm install
cp .env.example .env.local   # add TINYFISH_API_KEY (optional)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). First local run bootstraps one rate sweep automatically. No `TINYFISH_API_KEY`? Every bank falls back to realistic simulated rates, so the demo always works.

## Environment variables

| Variable | Description |
|---|---|
| `TINYFISH_API_KEY` | TinyFish agent key. Unset → rates and applications are simulated. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Free Redis at [upstash.com](https://upstash.com). |
| `CRON_SECRET` | Any random string, protects `/api/sweep` from random requests. |

## Deploying

1. Push to GitHub, import into Vercel, add the four env vars above.
2. On the GitHub repo, add Actions secrets `APP_URL` (your Vercel URL) and `CRON_SECRET` (same value).
3. `.github/workflows/sweep.yml` fires automatically every day at 14:00 Vietnam time.

## Notes for the pitch

- The one hard safety boundary: the agent **never** submits a binding financial application. It fills every field it can find and stops — the person reviews and clicks submit themselves, bank by bank.
- Shinhan is never scraped for its own data (it already knows its own rates) — only competitors are, which is the actual hard intelligence problem worth automating.
- Sorting correctly handles that "best" means opposite things for the two product kinds: highest APY for savings, lowest rate for loans.
