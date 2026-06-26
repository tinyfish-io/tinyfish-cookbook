import { eq, sql } from "drizzle-orm";
import { stepCountIs, streamText, tool } from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import type { BriefingPayload, VideoCandidate } from "@/lib/demo-data";
import {
  inferIntent,
  researchMatchInfo,
  searchWorldCupVideos,
  type SearchResponse,
} from "@/lib/video-pipeline";
import { AGENT_SYSTEM_PROMPT, videoCandidateSchema } from "@/lib/agent-tools";
import { db, runs, freeRunCounts } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { resolveSessionToken } from "@/lib/session";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
// Vercel Hobby plan caps Serverless Function duration at 300s.
export const maxDuration = 300;

type AgentToolCall = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  summary: string;
  details?: unknown;
};

type StreamEvent =
  | { type: "run_id"; runId: string }
  | { type: "meta"; model: string; prompt: string }
  | { type: "text-delta"; text: string }
  | { type: "tool"; toolCall: AgentToolCall }
  | { type: "reel-dispatched" }
  | {
      type: "finish";
      data: {
        mode: "agent";
        model: string;
        prompt: string;
        toolCalls: AgentToolCall[];
        search: SearchResponse | null;
        selectedVideo: VideoCandidate | null;
        briefing: BriefingPayload | null;
        runId?: string;
      };
    }
  | {
      type: "error";
      error: string;
      data: {
        mode: "agent-error";
        prompt: string;
        toolCalls: AgentToolCall[];
        search: SearchResponse | null;
        selectedVideo: VideoCandidate | null;
        briefing: BriefingPayload | null;
      };
    };

import { getModel } from "@/lib/llm";

function summarizeSearch(search: SearchResponse) {
  return {
    mode: search.mode,
    query: search.query,
    source: search.source,
    error: search.error,
    results: search.results.slice(0, 6),
  };
}

function shouldCreateReel(prompt: string) {
  return /\b(foul|fouls|goal|goals|card|cards|yellow|red|penalt|highlight|highlights|reel|clip|clips|moment|moments|match|game|world cup|soccer|football)\b/i.test(
    prompt,
  );
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: StreamEvent) {
  try {
    controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
  } catch {
    // Controller may already be closed if the client disconnected or stream errored.
  }
}

// AI SDK stream error parts carry `unknown`, and OpenRouter failures are often
// plain objects — extract something readable instead of "Agent run failed".
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Agent run failed";
  }
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

const FREE_RUN_LIMIT = 3;

function clientIP(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
  } | null;

  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return new Response(
      JSON.stringify({ error: "prompt is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const sessionToken = request.headers.get("x-session-token");
  let tfApiKey: string;
  let vdbApiKey: string;
  let apiKeyHash: string;

  if (sessionToken) {
    const session = resolveSessionToken(sessionToken);
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    tfApiKey = session.tfApiKey;
    vdbApiKey = session.vdbApiKey;
    apiKeyHash = session.apiKeyHash;
  } else {
    const houseTf = process.env.HOUSE_TF_API_KEY;
    const houseVdb = process.env.HOUSE_VDB_API_KEY;
    if (!houseTf || !houseVdb) {
      return new Response(
        JSON.stringify({ error: "Free runs are not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const ip = clientIP(request);
    const ipHash = sha256(ip);

    try {
      const [result] = await db
        .insert(freeRunCounts)
        .values({ ipHash, count: 1 })
        .onConflictDoUpdate({
          target: freeRunCounts.ipHash,
          set: {
            count: sql`${freeRunCounts.count} + 1`,
            updatedAt: new Date(),
          },
          setWhere: sql`${freeRunCounts.count} < ${FREE_RUN_LIMIT}`,
        })
        .returning({ count: freeRunCounts.count });

      if (!result) {
        return new Response(
          JSON.stringify({ error: "free_runs_exhausted", remaining: 0, limit: FREE_RUN_LIMIT }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    } catch (err) {
      logger.error({ err }, "Failed to increment free-run count");
      return new Response(
        JSON.stringify({ error: "Unable to process free run" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    tfApiKey = houseTf;
    vdbApiKey = houseVdb;
    apiKeyHash = sha256(houseVdb);
  }
  const modelName = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";
  const runId = crypto.randomUUID();
  const toolCalls: AgentToolCall[] = [];
  let search: SearchResponse | null = null;
  let selectedVideo: VideoCandidate | null = null;
  const briefing: BriefingPayload | null = null;
  let reelRunId: string | null = null;
  const timeline: Record<string, unknown>[] = [];

  function writeAndTrack(controller: ReadableStreamDefaultController<Uint8Array>, event: StreamEvent) {
    timeline.push(event as unknown as Record<string, unknown>);
    writeEvent(controller, event);
    scheduleFlush();
  }

  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      try {
        await db.update(runs).set({ timeline }).where(eq(runs.id, runId));
      } catch {}
    }, 300);
  }

  async function flushTimeline() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    try {
      await db.update(runs).set({ timeline }).where(eq(runs.id, runId));
    } catch {}
  }

  try {
    await db.insert(runs).values({
      id: runId,
      query: prompt,
      status: "processing",
      apiKeyHash,
      statusMessage: "Got it! Cooking up your soccer reel...",
    });
  } catch (err) {
    logger.error({ err }, "Failed to insert processing run");
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      writeAndTrack(controller, { type: "run_id", runId });
      writeAndTrack(controller, { type: "meta", model: modelName, prompt });

      try {
    const intent = inferIntent(prompt);
    const result = streamText({
      model: getModel(),
      stopWhen: stepCountIs(7),
      system: AGENT_SYSTEM_PROMPT,
      prompt: `User request: ${prompt}

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
            writeAndTrack(controller, {
              type: "tool",
              toolCall: {
                id: "tinyfish-research",
                name: "TinyFish research",
                status: "running",
                summary: `Researching: "${query}"`,
              },
            });
            try {
              await db.update(runs).set({
                statusMessage: "Digging into match reports for the juicy details...",
              }).where(eq(runs.id, runId));
            } catch {}
            try {
              const research = await researchMatchInfo(query, tfApiKey);
              toolCalls.push({
                id: "tinyfish-research",
                name: "TinyFish research",
                status: "done",
                summary: research.note
                  ? research.note
                  : `Read ${research.pages.length} match report${research.pages.length === 1 ? "" : "s"} from ${research.results.length} results.`,
                details: { query, results: research.results },
              });
              writeAndTrack(controller, {
                type: "tool",
                toolCall: toolCalls[toolCalls.length - 1],
              });
              return research;
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "TinyFish research failed";
              toolCalls.push({
                id: "tinyfish-research",
                name: "TinyFish research",
                status: "error",
                summary: message,
              });
              writeAndTrack(controller, {
                type: "tool",
                toolCall: toolCalls[toolCalls.length - 1],
              });
              // Research is best-effort: report the failure to the model so it
              // can continue without ground truth instead of aborting the run.
              return { query, results: [], pages: [], note: message };
            }
          },
        }),
        tinyfishSearch: tool({
          description:
            "Search the web with TinyFish for candidate YouTube football match videos.",
          inputSchema: z.object({
            query: z.string().describe("A concise search query for the target football match video."),
          }),
          execute: async ({ query }) => {
            try {
              writeAndTrack(controller, {
                type: "tool",
                toolCall: {
                  id: "tinyfish",
                  name: "TinyFish search",
                  status: "running",
                  summary: `Searching the web: "${query}"`,
                },
              });
              try {
                await db.update(runs).set({
                  statusMessage: "Scouring the web for the best match footage...",
                }).where(eq(runs.id, runId));
              } catch {}
              search = await searchWorldCupVideos(query, tfApiKey);
              selectedVideo = search.results[0] || null;
              toolCalls.push({
                id: "tinyfish",
                name: "TinyFish search",
                status: search.mode === "live-error" ? "error" : "done",
                summary:
                  search.mode === "live-error"
                    ? `TinyFish returned fallback candidates: ${search.error}`
                    : `Returned ${search.results.length} candidate videos.`,
                details: summarizeSearch(search),
              });
              writeAndTrack(controller, {
                type: "tool",
                toolCall: toolCalls[toolCalls.length - 1],
              });

              return summarizeSearch(search);
            } catch (error) {
              const message = error instanceof Error ? error.message : "TinyFish search failed";
              toolCalls.push({
                id: "tinyfish",
                name: "TinyFish search",
                status: "error",
                summary: message,
              });
              writeAndTrack(controller, {
                type: "tool",
                toolCall: toolCalls[toolCalls.length - 1],
              });
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
          execute: async ({ topic, video, knownEvents }) => {
            selectedVideo = video;
            reelRunId = runId;

            try {
              await db.update(runs).set({
                topic,
                selectedVideo: video,
                inngestEventId: `app/reel.create:${runId}`,
                statusMessage: "Building your highlight reel — our AI is scanning every frame...",
              }).where(eq(runs.id, runId));
            } catch {} // non-critical, Inngest carries the data

            try {
              await inngest.send({
                name: "app/reel.create",
                data: {
                  runId,
                  topic,
                  video,
                  knownEvents,
                  tfApiKey,
                  vdbApiKey,
                  apiKeyHash,
                },
              });
              writeAndTrack(controller, { type: "reel-dispatched" });
            } catch (err) {
              logger.error({ err }, "Failed to send Inngest event");
              try {
                await db.update(runs).set({
                  status: "failed",
                  errorMessage: "Failed to dispatch background pipeline",
                  statusMessage: "Failed to dispatch pipeline",
                  completedAt: new Date(),
                }).where(eq(runs.id, runId));
              } catch {} // best-effort
            }

            toolCalls.push({
              id: "videodb",
              name: "VideoDB reel",
              status: "done",
              summary: "Building your reel...",
              details: { runId },
            });
            writeAndTrack(controller, {
              type: "tool",
              toolCall: toolCalls[toolCalls.length - 1],
            });

            return {
              mode: "processing",
              runId,
              message: "Your reel is being compiled. This takes a minute or two.",
            };
          },
        }),
      },
    });

    // The client concatenates consecutive text-deltas, so insert a paragraph
    // break when the model resumes narrating after a tool call.
    let emittedText = false;
    let toolSinceText = false;
    // Don't kill the run on a model/tool error — record it and let the
    // deterministic fallback pipeline below finish the reel anyway.
    let streamError: string | null = null;
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        const text = toolSinceText && emittedText ? `\n\n${part.text}` : part.text;
        emittedText = true;
        toolSinceText = false;
        writeAndTrack(controller, { type: "text-delta", text });
      }
      if (part.type === "tool-call" || part.type === "tool-result") {
        toolSinceText = true;
      }
      if (part.type === "error" || part.type === "tool-error") {
        streamError = errorMessage(part.error);
        break;
      }
    }

    if (!search && shouldCreateReel(prompt)) {
      search = await searchWorldCupVideos(prompt, tfApiKey);
      selectedVideo = search.results[0] || null;
      toolCalls.push({
        id: "tinyfish-fallback",
        name: "TinyFish search",
        status: search.mode === "live-error" ? "error" : "done",
        summary:
          search.mode === "live-error"
            ? `TinyFish returned fallback candidates: ${search.error}`
            : `Returned ${search.results.length} candidate videos.`,
        details: summarizeSearch(search),
      });
      writeAndTrack(controller, {
        type: "tool",
        toolCall: toolCalls[toolCalls.length - 1],
      });
    }

    if (!briefing && selectedVideo && !reelRunId && search?.mode === "live") {
      reelRunId = runId;

      try {
        await db.update(runs).set({
          topic: prompt,
          selectedVideo,
          inngestEventId: `app/reel.create:${runId}`,
          statusMessage: "Building your highlight reel — our AI is scanning every frame...",
        }).where(eq(runs.id, runId));
      } catch {} // non-critical

      try {
        await inngest.send({
          name: "app/reel.create",
          data: {
            runId,
            topic: prompt,
            video: selectedVideo,
            knownEvents: undefined,
            tfApiKey,
            vdbApiKey,
            apiKeyHash,
          },
        });

        writeAndTrack(controller, { type: "reel-dispatched" });
      } catch (err) {
        logger.error({ err }, "Failed to send Inngest event (fallback)");
        try {
          await db.update(runs).set({
            status: "failed",
            errorMessage: "Failed to dispatch background pipeline",
            statusMessage: "Failed to dispatch pipeline",
            completedAt: new Date(),
          }).where(eq(runs.id, runId));
        } catch {} // best-effort
      }

      toolCalls.push({
        id: "videodb-fallback",
        name: "VideoDB reel",
        status: "done",
        summary: "Building your reel...",
        details: { runId },
      });
      writeAndTrack(controller, {
        type: "tool",
        toolCall: toolCalls[toolCalls.length - 1],
      });
    }

        if (!reelRunId && (briefing || search?.mode === "live-error" || streamError)) {
          try {
            const b = briefing as BriefingPayload | null;
            const isError = b?.mode === "live-error" || !!streamError;
            await db.update(runs).set({
              topic: b?.topic ?? null,
              status: isError ? "failed" : "completed",
              mode: b?.mode ?? null,
              selectedVideo: b?.selectedVideo ?? null,
              streamUrl: b?.streamUrl ?? null,
              playerUrl: b?.playerUrl ?? null,
              events: b?.events ?? null,
              summary: b?.summary ?? null,
              errorMessage: streamError ?? b?.error ?? null,
              completedAt: new Date(),
            }).where(eq(runs.id, runId));
          } catch {} // best-effort
        }

        if (streamError && !briefing && !reelRunId) {
          throw new Error(streamError);
        }
        if (streamError && reelRunId) {
          writeAndTrack(controller, {
            type: "text-delta",
            text: `${emittedText ? "\n\n" : ""}The AI planner hit an error (${streamError}), but the reel has been dispatched to the background pipeline.`,
          });
        }

        writeAndTrack(controller, {
          type: "finish",
          data: {
            mode: "agent",
            model: modelName,
            prompt,
            toolCalls,
            search,
            selectedVideo,
            briefing,
            runId: reelRunId || undefined,
          },
        });
      } catch (error) {
        try {
          await db.update(runs).set({
            status: "failed",
            errorMessage: errorMessage(error),
            statusMessage: "Failed",
            completedAt: new Date(),
          }).where(eq(runs.id, runId));
        } catch {} // best-effort
        writeAndTrack(controller, {
          type: "error",
          error: errorMessage(error),
          data: {
            mode: "agent-error",
            prompt,
            toolCalls,
            search,
            selectedVideo,
            briefing,
          },
        });
      } finally {
        await flushTimeline();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
