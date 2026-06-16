# Wing Command v4

**Find the best chicken wings near you — powered by TinyFish + Gemini.**

Enter a zip code and flavor preference. Wing Command dispatches parallel TinyFish browser agents across DoorDash, UberEats, Grubhub, Yelp, and Google — streaming live results back as each agent completes.

## Architecture

```
User enters zip code + flavor
        ↓
/api/scout (SSE)
  ├── Gemini discovers 5-7 source URLs for the location
  └── TinyFish agents scrape each source in parallel
        ↓
Results stream to UI as each agent completes
```

## TinyFish API Usage

```typescript
import { TinyFish, EventType, RunStatus } from '@tiny-fish/sdk';

const client = new TinyFish({ apiKey: process.env.TINYFISH_API_KEY });

const stream = await client.agent.stream({ url, goal });

for await (const event of stream) {
  if (event.type === EventType.COMPLETE) {
    if (event.status === RunStatus.COMPLETED) {
      // event.result contains extracted restaurant data
    }
    break;
  }
}
```

Results are streamed back to the browser via SSE (`TransformStream`) as each agent finishes.

## Setup

```bash
cd wing-command
npm install
cp .env.example .env.local
# Fill in your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description |
|---|---|
| `TINYFISH_API_KEY` | TinyFish browser agents — get yours at [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys) |
| `GEMINI_API_KEY` | URL discovery via gemini-2.0-flash — get yours at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Web scraping | TinyFish Agent API (`@tiny-fish/sdk`) |
| URL discovery | Google Gemini (`@google/generative-ai`) |
| Streaming | Server-Sent Events via TransformStream |
| Styling | Tailwind CSS |

## Constraint Checklist

| Constraint | Status |
|---|---|
| Raw SSE fetch? | NO — uses `@tiny-fish/sdk` |
| Mino references? | NO — all removed |
| Hardcoded secrets? | NO — `.env.local` only |
| Module-level SDK instantiation? | NO — instantiated inside handler |
| External database? | NO — pure in-memory |
