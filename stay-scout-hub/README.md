# Stay Scout Hub
**Live Demo:** _add URL after deploy_

**Smart hotel research tool — AI agents find the right neighborhood before you book.**

Enter your destination, travel purpose, and dates. Stay Scout discovers the best neighborhoods for your trip using real travel guides, then researches each area via Google Maps agents streaming results live.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                       │
│                                                             │
│  SearchFormV2 → PurposeSelector → AreaResultsSection        │
│                 (results stream in as agents finish)        │
└────────────────────────────┬────────────────────────────────┘
                             │
               ┌─────────────┴─────────────┐
               │                           │
               ▼                           ▼
┌──────────────────────────┐  ┌────────────────────┐
│ /api/discover-areas      │  │ /api/research-area │
│                          │  │                    │
│ TinyFish Search          │  │ TinyFish Agent     │
│ → find travel guides     │  │ client.agent       │
│                          │  │ .stream(...)       │
│ TinyFish Fetch           │  │                    │
│ → extract neighborhoods  │  │ SSE → client       │
│                          │  │                    │
│ Gemini LLM               │  │                    │
│ → structure results      │  │                    │
└──────────────────────────┘  └────────────────────┘
```

### All three TinyFish APIs — each used for what it does best

```
Search API  → client.search.query({ query })
              Discovers relevant travel guide URLs
              No browser needed — fast structured results

Fetch API   → client.fetch.getContents({ urls, format: "markdown" })
              Extracts clean text from travel guides found by Search
              Up to 10 URLs per call, returned as clean markdown

Agent API   → client.agent.stream({ url, goal })
              Full browser navigation for Google Maps area research
              EventType.STREAMING_URL → live iframe in UI
              EventType.COMPLETE + RunStatus.COMPLETED → event.result
```

## Flow

1. User enters city, purpose, dates, guests
2. **`/api/discover-areas`** — Search finds travel guides → Fetch extracts neighborhood content → Gemini structures into area recommendations
3. **`/api/research-area`** — one TinyFish agent per area navigates Google Maps, returns suitability score, pros/cons, walkability, noise level, top hotels (streamed via SSE)

## Purpose Modes

| Purpose | What it optimises for |
|---|---|
| Business | Proximity to business district, conference centers |
| Exam / Interview | Quiet area, good sleep, low noise |
| Family Visit | Family-friendly, comfortable, residential |
| Sightseeing | Walking distance to attractions, transport |
| Late Night | Nightlife access, flexible check-in |
| Airport Transit | Proximity to airport, shuttle access |

## Setup

### Prerequisites

- Node.js 18+
- TinyFish API key
- Gemini API key

### Environment Variables

```bash
cp .env.example .env.local
```

Then fill in:

```env
# TinyFish (required) — https://agent.tinyfish.ai/api-keys
TINYFISH_API_KEY=your-tinyfish-api-key

# Google Gemini (required) — https://aistudio.google.com/apikey
GEMINI_API_KEY=your-gemini-api-key
```

### Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Project Structure

```
stay-scout-hub/
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # Root layout
│   │   ├── page.tsx                     # Main UI
│   │   ├── globals.css
│   │   └── api/
│   │       ├── discover-areas/          # Search + Fetch → neighborhood discovery
│   │       └── research-area/           # Agent → Google Maps area research (SSE)
│   ├── components/
│   │   ├── SearchFormV2.tsx
│   │   ├── PurposeSelector.tsx
│   │   ├── AreaCard.tsx
│   │   ├── AreaResultsSection.tsx       # Renders area results as agents complete
│   │   └── LiveBrowserPreview.tsx       # Live agent iframe grid
│   ├── hooks/
│   │   └── useAreaSearch.ts             # Area discovery + research state
│   ├── lib/
│   │   ├── api/area-search.ts
│   │   └── utils.ts
│   └── types/hotel.ts
├── next.config.ts
└── package.json
```

## Constraint Checklist

| Constraint | Status |
|---|---|
| External database used? | NO (pure in-memory) |
| Cache layer used? | NO (all results fetched live) |
| All three TinyFish APIs used? | YES (Search, Fetch, Agent) |
| Area research via real browser? | YES (`client.agent.stream` → Google Maps) |
| Live browser preview? | YES (`EventType.STREAMING_URL` → iframe) |

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Browser Agents:** TinyFish SDK (`client.agent.stream`, `client.search.query`, `client.fetch.getContents`)
- **LLM:** Gemini (`gemini-2.0-flash`) for structuring extracted content
- **Deployment:** Vercel
