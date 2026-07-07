# Founder Mode

An accelerator and grant application copilot for the Vietnam startup ecosystem. Discovers open programs, extracts real application questions, drafts answers with AI using your company profile, and — once you're ready — actually fills and submits the real form.

## How it actually works

The real scraping and application work does **not** run on Vercel — same reasoning as FareGuard: a full discovery sweep across 6 sites plus per-application form extraction/drafting/filling can take longer than Vercel's function time limit. The heavy lifting runs on a free **GitHub Actions** schedule instead:

```
GitHub Actions (every 8 hours)
  → scripts/discover.ts
  → calls TinyFish for all 6 sources in parallel
  → writes discovered programs straight to Redis

Vercel (your deployed site)
  → reads programs/applications from Redis
  → dragging a program into the pipeline creates an application and
    kicks off extraction + drafting in the background immediately
  → submitting an application is an explicit, separate action you trigger
```

## The 6 sources (agreed before building, not guessed)

- **VIISA** — viisa.vn
- **VSV Capital** (formerly Vietnam Silicon Valley Accelerator) — vsvcapital.com.vn
- **ThinkZone** — thinkzone.vn
- **Antler Vietnam** — antler.co
- **Techfest Vietnam** — techfest.vn (government-backed)
- **F6S** — f6s.com, the aggregator directory (13,000+ programs), filtered to Vietnam/SEA. Notably, several Vietnam accelerators (e.g. VSV Capital) actually host their real application form on F6S rather than their own site.

Portfolio/founder mapping data comes from these same 5 named organizations' own public "portfolio" pages — deliberately **not** LinkedIn or Crunchbase, which either prohibit scraping in their ToS or are aggressively bot-protected.

## The application pipeline

1. **Discovered** — found by a discovery sweep, sitting in the feed
2. **Extracting** — an agent visits the real application form and reads every question, with its character limit if shown
3. **Drafting** — Groq (Llama 3.3 70B) writes an answer for each question using your Company Profile — never fabricates facts not in the profile
4. **Ready for review** — answers are editable before you submit
5. **Submitted** — an agent fills the real form with the (possibly edited) answers and submits it

Submission is real, not simulated — an explicit decision for this testing phase, since it isn't touching a real company's live applications yet.

## Company profile

The Company Profile page is a real editable form (name, pitch, sector, stage, traction, founders) that saves to the database via `PUT /api/company-profile`. This is the source of truth every drafted answer pulls from — better filled in, better drafts.

## Tech stack

- Next.js 14 (App Router) + TypeScript, Tailwind CSS, Geist font
- TinyFish Agent API (stealth browser profile) for discovery, form extraction, and form filling
- Groq (Llama 3.3 70B) for drafting answers
- Redis (Upstash) for persistence — falls back to a local file automatically without it configured
- GitHub Actions for the actual scheduled discovery sweep

## Run locally

```bash
npm install
npm run dev
```

Works immediately with seed data and no env vars. Add `TINYFISH_API_KEY` to `.env.local` to get one real discovery sweep automatically on first load.

## Deploy

Same shape as FareGuard:

1. Push to its own GitHub repo (not a subfolder of another repo — keeps Vercel's Root Directory and the GitHub Actions workflow path simple)
2. Add Redis via Vercel's Storage → Marketplace → Redis (or Upstash directly)
3. Add env vars on Vercel: `TINYFISH_API_KEY`, `GROQ_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CRON_SECRET` (any random string), `GITHUB_TOKEN` (PAT with `workflow` scope), `GITHUB_REPO`
4. Add the same 4 secrets (`TINYFISH_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `GROQ_API_KEY`) as GitHub repo secrets under Settings → Secrets and variables → Actions
5. Deploy — `.github/workflows/discover.yml` starts firing every 8 hours automatically once pushed

## Reset local state

```bash
npm run reset:local
```
Wipes the local JSON store so the next `npm run dev` behaves like a brand new install.
