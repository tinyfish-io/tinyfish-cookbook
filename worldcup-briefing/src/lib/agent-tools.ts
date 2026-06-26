import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { VideoCandidate } from "@/lib/demo-data";
import { getModel } from "@/lib/llm";
import { logger } from "@/lib/logger";
import {
  inferIntent,
  researchMatchInfo,
  searchWorldCupVideos,
  type SearchResponse,
} from "@/lib/video-pipeline";

export const AGENT_SYSTEM_PROMPT = `You are a passionate, energetic soccer analyst inside a World Cup moments reel maker. You love the game — the drama of a last-minute tackle, the roar after a perfectly placed goal, the tension of a penalty shootout. Your tone is warm, excited, and conversational, like a co-commentator sitting next to a fan on the couch.

The product helps users ask for moments from a soccer match, such as fouls, goals, cards, penalties, celebrations, or tactical highlights. TinyFish finds useful web video sources. VideoDB uploads the selected video, indexes visual scenes, searches for event timestamps, and compiles a playable highlight reel.

If the user greets you, asks what this app does, or gives a vague non-soccer request, respond with your excited, soccer-obsessed personality briefly. Explain that you can create World Cup moment reels when they tell you a match and what they're looking for.

Use tools only when the user is clearly asking to create/find a soccer video reel or soccer match moments. Do not call tools for greetings, small talk, or general explanation questions.

Tool workflow (follow exactly):
1. Call tinyfishResearch first (1-2 calls max) to gather ground truth about the requested moments from match reports and live-commentary timelines. Information that helps VideoDB the most:
   - the match minute of each requested event (e.g. "red card 63'"),
   - the players involved,
   - which half it happened in,
   - how many events of the requested type occurred in total,
   - the final score for context.
   Good queries look like "Mexico South Africa red cards minute match report". Skip research when the user's request is vague (e.g. just "highlights") — go straight to step 2.
2. After research, write 1-2 excited, punchy sentences telling the user what you found BEFORE calling the next tool — e.g. "Found 'em! 3 red cards in this feisty clash — Zwane (61'), Ramírez (88'), Mokoena (90+2') with a stoppage-time stunner. Let me grab the match video now!" If research found nothing, say that briefly but keep the tone upbeat. Never skip this narration.
3. Call tinyfishSearch once. Search for THE MATCH, not the moments. Name both teams plus the competition or year — e.g. "Argentina vs France 2022 highlights". Never include moment types ("goals", "fouls", "cards") or player names in the search query. VideoDB's scene index finds those moments inside the match footage.
4. Pick ONE candidate: prefer videoType "match highlights", then the highest confidence. Avoid press conferences, analysis, and fan reactions unless the user asked for them. Before calling videoDbCreateReel, write one short, excited sentence naming which video you picked — e.g. "Going with FIFA's official extended highlights — this is the good stuff. Building your reel now!"
5. Call videoDbCreateReel exactly once with the user's original request as topic and the selected candidate object passed through unchanged (do not edit its fields). If research found concrete events, fill knownEvents — one entry per event, label like "Red card — Player Name", minute as a plain number when known. Only include events you actually found evidence for; never invent them. If research found nothing reliable, omit knownEvents entirely.

6. Write the final reply.

Final reply rules:
- Your tone is a hype commentator: enthusiastic, punchy, a little dramatic — as if you're narrating the reel itself. Use em dashes, a few well-placed emojis (⚽️ 🟨 🟥 🎯), and short impactful sentences.
- Start with a brief, exciting intro line that sets the scene. Then a bulleted list of the moments with their timestamps exactly as returned. Do not repeat the same timestamp twice.
- Only state facts returned by the tools. Never invent timestamps, player names, scores, or URLs.
- Do not paste the raw player or stream URL; the app renders the player below your message automatically.
- If the tool result has mode "live-error" or mentions a fallback, tell the user plainly that live processing hit a snag, include the reason, but keep it forward-looking.
- If some moment categories were missed, mention it honestly instead of padding the list.
- Reel creation now runs in the background. When the tool returns mode "processing", tell the user the reel is cooking and will appear shortly — the page will auto-refresh when it's ready. Keep it excited, like "Your reel is in the works! It'll pop up right here the moment it's ready."`;

export const videoCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  source: z.string(),
  duration: z.string(),
  teams: z.array(z.string()),
  match: z.string(),
  videoType: z.enum(["match highlights", "press conference", "analysis", "fan reaction"]),
  confidence: z.number(),
});

export type AgentPipelineResult = {
  selectedVideo: VideoCandidate | null;
  knownEvents?: Array<{ label: string; minute?: number; half?: "1st" | "2nd" }>;
  topic: string;
  search: SearchResponse | null;
};

export async function createAgentPipeline(params: {
  prompt: string;
  tfApiKey: string;
}): Promise<AgentPipelineResult> {
  const intent = inferIntent(params.prompt);
  let search: SearchResponse | null = null;
  let selectedVideo: VideoCandidate | null = null;
  let knownEvents: Array<{ label: string; minute?: number; half?: "1st" | "2nd" }> | undefined;
  let topic = params.prompt;

  try {
    const genResult = await generateText({
      model: getModel(),
      stopWhen: stepCountIs(7),
      system: AGENT_SYSTEM_PROMPT,
      prompt: `User request: ${params.prompt}

Detected event type: ${intent.eventType}
Preferred VideoDB scene searches: ${intent.searches
        .map(([label, queries]) => `${label}: ${queries.join(", ")}`)
        .join(" | ")}`,
      tools: {
        tinyfishResearch: tool({
        description:
          "Research match facts on the web with TinyFish: event timelines, match minutes, players involved, scorelines. Returns search snippets plus the content of the top match-report pages.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              'A focused web query for match facts, e.g. "Mexico South Africa red cards minute match report".',
            ),
        }),
        execute: async ({ query }) => {
          try {
            return await researchMatchInfo(query, params.tfApiKey);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "TinyFish research failed";
            return { query, results: [], pages: [], note: message };
          }
        },
      }),
      tinyfishSearch: tool({
        description:
          "Search the web with TinyFish for candidate YouTube soccer match videos.",
        inputSchema: z.object({
          query: z.string().describe("A concise search query for the target soccer match video."),
        }),
        execute: async ({ query }) => {
          try {
            search = await searchWorldCupVideos(query, params.tfApiKey);
            selectedVideo = search.results[0] || null;
            return {
              mode: search.mode,
              query: search.query,
              source: search.source,
              error: search.error,
              results: search.results.slice(0, 6),
            };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "TinyFish search failed";
            logger.error({ err: message, query }, "createAgentPipeline tinyfishSearch failed");
            return { mode: "error", query, source: null, error: message, results: [] };
          }
        },
      }),
      videoDbCreateReel: tool({
        description:
          "Use VideoDB to upload a selected video, index visual scenes, search timestamped events, and compile a playable stream.",
        inputSchema: z.object({
          topic: z.string().describe("The original user request."),
          video: videoCandidateSchema.describe("The selected candidate video returned by TinyFish."),
          knownEvents: z
            .array(
              z.object({
                label: z
                  .string()
                  .describe('Short event label, e.g. "Red card — Player Name".'),
                minute: z
                  .number()
                  .nullish()
                  .describe("Match minute the event happened, when research found it."),
                half: z.enum(["1st", "2nd"]).optional(),
              }),
            )
            .optional()
            .describe(
              "Ground-truth events found via tinyfishResearch. Only include events with real evidence.",
            ),
        }),
        execute: async (args) => {
          selectedVideo = args.video as VideoCandidate;
          topic = args.topic;
          knownEvents = args.knownEvents as
            | Array<{ label: string; minute?: number; half?: "1st" | "2nd" }>
            | undefined;
          return {
            mode: "captured" as const,
            message: "Pipeline captured for background execution.",
          };
        },
      }),
    },
  });

    logger.info(
      {
        hasSearch: search !== null,
        hasVideo: selectedVideo !== null,
        hasKnownEvents: knownEvents !== undefined,
        finishReason: genResult.finishReason,
      },
      "createAgentPipeline generateText completed",
    );

  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error), prompt: params.prompt },
      "createAgentPipeline generateText threw",
    );
  }

  return { selectedVideo, knownEvents, topic, search };
}
