# World Cup Briefing
**Live Demo: https://worldcup-briefing.vercel.app**

**AI-powered football highlight reels — find match footage with TinyFish Search & Agent, then compile playable clips with VideoDB.**

Tell it what you want — "all yellow cards from Brazil vs Morocco" or "penalty moments from Mexico vs South Africa" — and an AI agent uses TinyFish to discover the best YouTube match footage, VideoDB to index every scene visually, hunt down the moments you asked for, and compile them into a stream you can watch immediately.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│                                                                  │
│  Natural-language input → SSE stream → live tool-call timeline  │
│  Reel player + Instant Replay with speed controls               │
│  Public gallery + Personal briefings + Scheduled briefings      │
└─────────────────────────────┬────────────────────────────────────┘
                              │ POST /api/agent { prompt, apiKeys }
                              │ (SSE — tool calls stream in real time)
┌─────────────────────────────▼────────────────────────────────────┐
│                     Next.js App Router                           │
│                                                                  │
│  /api/agent/route.ts                                             │
│    │                                                             │
│    ├─ AI Agent (OpenRouter / DeepSeek)                           │
│    │     │                                                       │
│    │     ├─ tinyfishResearch (tool)                              │
│    │     │    TinyFish Search API → match reports, event facts   │
│    │     │    Returns: goals, cards, fouls with timestamps       │
│    │     │                                                       │
│    │     ├─ tinyfishSearch (tool)                                │
│    │     │    TinyFish Search API → YouTube match footage        │
│    │     │    Custom scoring: prefers full/long videos           │
│    │     │    Filters shorts, highlights, noise                  │
│    │     │                                                       │
│    │     └─ videoDbCreateReel (tool)                             │
│    │          Dispatches Inngest background job                  │
│    │                                                             │
│    └─ Inngest Pipeline (async, no timeout)                       │
│          ├─ VideoDB: upload YouTube video                        │
│          ├─ VideoDB: build AI scene index                        │
│          ├─ VideoDB: search index for requested moments          │
│          ├─ VideoDB: compile matching clips → reel stream        │
│          └─ LLM: generate title + match summary                  │
│                                                                    │
│  Scheduled briefings: Inngest cron runs every minute             │
│  → picks up due schedules → same pipeline automatically         │
└──────────────────────────────────────────────────────────────────┘
```

### TinyFish SDK usage

```
TinyFish.Search({ query })          → tinyfishResearch  → match facts + timestamps
TinyFish.Search({ query })          → tinyfishSearch    → YouTube video candidates
TinyFish.agent.stream({ url, goal })→ demo data fallback→ structured video metadata

Custom scoring function filters candidate videos:
  ✓ Full matches & extended highlights (high confidence)
  ✓ Long-duration & high-view-count videos (medium confidence)
  ✗ Shorts, compilations, or noisy results (penalized)
```

## Features

- **Natural-language input** — ask for fouls, cards, goals, penalties, celebrations, or any moment
- **TinyFish-powered video discovery** — search finds the best YouTube match footage via Agent + Search
- **Visual scene indexing** — VideoDB's vision model analyzes frames at 4-6s intervals with timestamps
- **Reel compilation** — backtracking algorithm includes build-up context, merges overlapping clips
- **Scheduled briefings** — daily recurring briefings with custom run times, notified via Telegram/Discord/Slack
- **Public gallery** — curated community reels discoverable by anyone
- **Instant replay** — seekable timeline, variable speed (0.25x–2x), auto-scroll through key moments
- **Free tier** — 3 free runs per IP address
- **Dark mode** — full light/dark theme support

## TinyFish API Code Snippet

From `src/lib/video-pipeline.ts` — the TinyFish search that discovers match footage:

```typescript
import { TinyFish } from "@tiny-fish/sdk";

export async function searchCandidateVideos(
  query: string,
  apiKey: string
): Promise<CandidateResult> {
  const client = new TinyFish({
    apiKey,
    timeout: 30000,
    maxRetries: 1,
  });

  try {
    const results = await client.search({ query });

    // Score candidates: prefer full matches, long videos, high views
    const candidates = results
      .filter((r) => r.url?.includes("youtube.com/watch"))
      .map(scoreCandidate)
      .sort((a, b) => b.score - a.score);

    return {
      candidates: candidates.slice(0, 20),
      source: "TinyFish Search API",
      query,
    };
  } catch (error) {
    return {
      candidates: getDemoCandidates(query),
      source: "TinyFish Search API",
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}
```

**For research** (`tinyfishResearch` tool), TinyFish Search is called with match-specific queries like `"Brazil vs Morocco World Cup match report events timeline"` to extract exact minute-by-minute event data that VideoDB's scene index can match against.

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- TinyFish API key — [Get one here](https://agent.tinyfish.ai/api-keys)
- VideoDB API key — [Get one here](https://console.videodb.io)
- OpenRouter API key — [Get one here](https://openrouter.ai)

### Environment Variables

```bash
cp .env.example .env.local
```

Then fill in:

```env
# Database (required) — Azure PostgreSQL or any PG-compatible
DATABASE_URL=postgres://...

# OpenRouter (required) — powers the AI agent
OPEN_ROUTER_API_KEY=sk-or-...

# Encryption (required) — 32-byte hex for encrypting stored keys
ENCRYPTION_SECRET=$(openssl rand -hex 32)

# Admin (required) — for gallery seed/unseed management
ADMIN_SECRET=your-admin-secret

# TinyFish (optional — users can enter their own in the UI)
TINYFISH_API_KEY=sk-...

# VideoDB (optional — users can enter their own in the UI)
VIDEO_DB_API_KEY=sk-...

# Base URL (production only)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Click **Add API keys** in the header to enter your TinyFish and VideoDB keys, or set them via environment variables.

### Database

```bash
npm run db:generate   # Generate Drizzle migrations
npm run db:migrate    # Apply migrations
```

## Project Structure

```
worldcup-briefing/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout + metadata
│   │   ├── page.tsx                    # Landing page, compose bar, onboarding stepper
│   │   ├── b/[runId]/page.tsx          # Briefing viewer with player + send-to-inbox
│   │   ├── replay/[runId]/page.tsx     # Instant replay with timeline + speed controls
│   │   ├── gallery/page.tsx            # Public curated reels with search + pagination
│   │   ├── me/page.tsx                 # User's personal briefings
│   │   ├── schedules/page.tsx          # Schedule management + inbox setup
│   │   └── api/
│   │       ├── agent/route.ts          # POST — AI agent SSE streaming + TinyFish tools
│   │       ├── auth/route.ts           # Key validation + session tokens
│   │       ├── validate-keys/route.ts  # TinyFish + VideoDB key validation
│   │       ├── send-to-inbox/route.ts  # On-demand reel delivery
│   │       ├── credits/route.ts        # API key balance check
│   │       ├── gallery/route.ts        # Public runs list with search + pagination
│   │       ├── schedules/route.ts      # Schedule CRUD
│   │       ├── channels/route.ts       # Telegram/Discord/Slack inbox CRUD
│   │       ├── validate-channels/route.ts
│   │       ├── my-runs/route.ts        # User's runs with pagination
│   │       ├── run-status/[runId]/     # Poll run state during processing
│   │       ├── briefing/route.ts       # Briefing detail
│   │       ├── search/route.ts         # TinyFish search proxy
│   │       └── admin/                  # Seed/unseed gallery endpoints
│   ├── components/
│   │   ├── Header.tsx                  # Top nav with theme toggle + key management
│   │   ├── KeyModal.tsx                # TinyFish + VideoDB API key entry
│   │   ├── onboarding-stepper.tsx      # Interactive 4-step setup wizard
│   │   ├── BriefingCard.tsx            # Reel card with status, thumbnail, actions
│   │   ├── SendToInboxModal.tsx        # Send reel to inbox on demand
│   │   ├── LowCreditsBanner.tsx        # Low-balance warning
│   │   ├── Pagination.tsx              # Cursor-based pagination
│   │   ├── FallbackThumbnail.tsx       # Auto-generated gradient thumbnails
│   │   ├── ChannelIcon.tsx             # Telegram/Discord/Slack icons
│   │   └── ...
│   ├── lib/
│   │   ├── video-pipeline.ts           # TinyFish search + VideoDB pipeline
│   │   ├── agent-tools.ts              # AI agent tool definitions (TinyFish tools)
│   │   ├── notify.ts                   # Telegram + Discord + Slack notifications
│   │   ├── encrypt.ts                  # AES-256-GCM helpers
│   │   ├── session.ts                  # Encrypted session tokens
│   │   ├── llm.ts                      # LLM model configuration
│   │   ├── time.ts / timezone.ts       # Date/time utilities
│   │   └── db/                         # Drizzle schema + migrations
│   └── inngest/
│       ├── client.ts                   # Inngest setup
│       └── functions.ts                # createReel + checkSchedules
├── public/brand/                       # VideoDB + TinyFish brand assets
├── drizzle/                            # Database migrations
├── next.config.ts
└── package.json
```

## Constraint Checklist

| Constraint | Status |
|-----------|--------|
| External database used? | YES (PostgreSQL — stores runs, schedules, inbox configs) |
| TinyFish Search used? | YES (research + video discovery) |
| TinyFish Agent used? | YES (demo data fallback) |
| Streaming responses? | YES (SSE — agent tool calls streamed to client) |
| Background jobs? | YES (Inngest — async video indexing pipeline) |
| Multi-inbox delivery? | YES (Telegram, Discord, Slack) |
| Dark mode? | YES |

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- **AI Agent:** OpenRouter + Vercel AI SDK (`streamText` + `tool`)
- **Web Search & Discovery:** TinyFish SDK (`Search` + `Agent`)
- **Video Indexing:** VideoDB
- **Background Jobs:** Inngest
- **Database:** PostgreSQL (Azure) + Drizzle ORM
- **Encryption:** AES-256-GCM (Node.js `crypto`)
- **Logging:** Pino
- **Deployment:** Vercel
