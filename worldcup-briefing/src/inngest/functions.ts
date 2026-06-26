import { and, asc, eq, lte } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { randomUUID } from "crypto";
import { connect } from "videodb";
import { channels, db, runs, schedules, videoCache } from "@/lib/db";
import { decrypt, decryptJson } from "@/lib/encrypt";
import { llmGenerateJson } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { computeNextRunAt } from "@/lib/timezone";
import type { VideoCandidate } from "@/lib/demo-data";
import { normalizeYouTubeUrl } from "@/lib/normalize-url";
import {
  getOrCreateCollection,
  inferIntent,
  searchShotsAndCompileReel,
  searchWorldCupVideos,
  type KnownEvent,
} from "@/lib/video-pipeline";
import { createAgentPipeline } from "@/lib/agent-tools";
import type { BriefingEvent } from "@/lib/demo-data";
import { sendRunNotification } from "@/lib/notify";
import { inngest } from "./client";

type ReelEvent = {
  runId: string;
  topic: string;
  video: VideoCandidate;
  knownEvents?: KnownEvent[];
  tfApiKey: string;
  vdbApiKey: string;
  apiKeyHash: string;
  scheduleId?: string;
  notifyChannel?: string;
  notifyConfig?: Record<string, unknown>;
};

export const createReel = inngest.createFunction(
  {
    id: "create-reel",
    name: "Create Reel",
    triggers: [{ event: "app/reel.create" }],
    onFailure: async ({ event, error }) => {
      logger.error({ err: error.message }, "createReel onFailure");
      try {
        const raw = event as unknown as { data: { event?: { data?: ReelEvent } } };
        const runId = raw?.data?.event?.data?.runId;
        if (!runId) {
          logger.error("onFailure: could not find runId in event data");
          return;
        }
        await db
          .update(runs)
          .set({
            status: "failed",
            errorMessage: error.message,
            statusMessage: "Failed",
            completedAt: new Date(),
          })
          .where(eq(runs.id, runId));
        logger.info({ runId }, "onFailure: updated run to failed");
      } catch (dbError) {
        logger.error({ err: dbError }, "onFailure DB update error");
      }
    },
  },
  async ({ event, step }) => {
    const payload = event.data as ReelEvent;
    const { runId, topic, video, knownEvents, vdbApiKey, apiKeyHash, notifyChannel, notifyConfig } = payload;

    async function setStatus(msg: string) {
      try {
        const [row] = await db.select({ history: runs.statusHistory }).from(runs).where(eq(runs.id, runId)).limit(1);
        const history: Array<{ ts: string; msg: string }> = (row?.history as Array<{ ts: string; msg: string }>) ?? [];
        if (history.some((entry) => entry.msg === msg)) return;
        history.push({ ts: new Date().toISOString(), msg });
        await db.update(runs).set({ statusMessage: msg, statusHistory: history }).where(eq(runs.id, runId));
      } catch {}
    }

    async function say(message: string) {
      try {
        const [row] = await db.select({ t: runs.timeline }).from(runs).where(eq(runs.id, runId)).limit(1);
        const t = (row?.t as Array<{ type: string; text?: string }>) ?? [];
        if (t.some((entry) => entry.type === "text-delta" && entry.text === message)) return;
        t.push({ type: "text-delta", text: message });
        await db.update(runs).set({ timeline: t }).where(eq(runs.id, runId));
      } catch {}
    }

    function pick(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }

    const intent = inferIntent(topic);

    const UPLOAD_DONE_MSGS = [
      `Upload complete! Now building an AI scene index — VideoDB analyses every few seconds of the match. 🔍`,
      `Video's in! VideoDB is now watching every second, cataloguing each tackle and pass. ⚽️`,
      `Upload's done! Time for VideoDB's AI to scan through the footage like a hawk. 🦅`,
      `Video secured! The AI indexer is firing up — dissecting every moment frame by frame.`,
      `Match is live! VideoDB's neural engine is poring over every sequence right now. 🎥`,
    ];

    const INDEX_READY_MSGS = [
      `Scene index built! Now the hunt begins — scanning for ${intent.eventType} moments. 🎯`,
      `Index is HOT! VideoDB's search is now combing through every scene for ${intent.eventType}... 🔎`,
      `Frames analysed! Let's find those ${intent.eventType} — VideoDB search is on the prowl.`,
      `AI has watched the match. Now it's finding YOUR ${intent.eventType} — stand by! 👀`,
      `The AI knows every frame. Searching for those ${intent.eventType} now... almost showtime!`,
    ];

    const SEARCH_DONE_MSGS = [
      `Moments found! Stitching them into one glorious reel — almost there! 🎬`,
      `Clips locked! Rolling them into a highlight reel... the finish line is in sight! ✂️`,
      `Targets acquired! Compiling into a playable stream — your reel is taking shape. 📽️`,
      `Got 'em! Weaving those moments together into your highlight package... 🧵`,
      `Highlights secured! Rendering your reel now — this is the final stretch! ⚡`,
    ];

    const DONE_MSGS = [
      `Your reel is served! Hit play and relive every heartbeat of the action. ⚽️🔥`,
      `Reel's ready! Press play — the drama, the goals, the moments are all yours. 🎉`,
      `Fresh off the press! Your match reel is hot and ready. Go on, hit play! 🎯`,
      `Done and dusted! Your highlight reel is locked and loaded. Enjoy the show! ✨`,
      `Pipeline complete! Every frame scanned, every moment captured. Play it loud! 🔊`,
    ];

    await setStatus(`Uploading video to VideoDB...`);

    const { collectionId } = await step.run("get-or-create-collection", () => {
      const conn = connect(vdbApiKey);
      return getOrCreateCollection(conn, "world-cup-briefing")
        .then((coll) => ({ collectionId: coll.id }))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          const cause = (err as { cause?: string }).cause ?? "";
          if (
            msg.includes("Authentication") ||
            msg.includes("Invalid API Key") ||
            cause.includes("Invalid API Key")
          ) {
            throw new NonRetriableError(
              "Invalid VideoDB API key. Please check your key and try again.",
            );
          }
          throw err;
        });
    });

    const uploadResult = await step.run("upload-or-cache-video", async () => {
      const normalized = normalizeYouTubeUrl(video.url);
      if (!normalized) {
        throw new NonRetriableError(
          `Only YouTube URLs are supported. Got: ${video.url}`,
        );
      }
      const youtubeVideoId = normalized.videoId;

      if (youtubeVideoId) {
        const cached = await db
          .select({
            vdbVideoId: videoCache.vdbVideoId,
            thumbnailUrl: videoCache.thumbnailUrl,
            title: videoCache.title,
          })
          .from(videoCache)
          .where(eq(videoCache.youtubeVideoId, youtubeVideoId))
          .limit(1);

        if (cached.length > 0) {
          return {
            vdbVideoId: cached[0].vdbVideoId,
            title: cached[0].title || video.title,
            thumbnailUrl: cached[0].thumbnailUrl || null,
            isCached: true,
          };
        }
      }

      const conn = connect(vdbApiKey);
      const coll = await conn.getCollection(collectionId);
      const uploaded = await coll.uploadURL({
        url: video.url,
        name: video.title,
        mediaType: "video",
      });

      if (!uploaded || typeof uploaded !== "object" || !("id" in uploaded)) {
        throw new Error("VideoDB upload did not return a video object");
      }

      const vdbVideo = uploaded as { id: string; name?: string; thumbnail?: string };
      const thumb = vdbVideo.thumbnail || null;
      const vidTitle = vdbVideo.name || video.title;

      if (youtubeVideoId) {
        await db.insert(videoCache).values({
          youtubeVideoId,
          canonicalUrl: normalized!.canonicalUrl,
          vdbVideoId: vdbVideo.id,
          apiKeyHash,
          thumbnailUrl: thumb,
          title: vidTitle,
          intentIndexIds: {},
        }).onConflictDoNothing();

        const actual = await db
          .select({ vdbVideoId: videoCache.vdbVideoId })
          .from(videoCache)
          .where(
            and(
              eq(videoCache.youtubeVideoId, youtubeVideoId),
              eq(videoCache.apiKeyHash, apiKeyHash),
            ),
          )
          .limit(1);

        if (actual.length > 0) {
          return { vdbVideoId: actual[0].vdbVideoId, title: vidTitle, thumbnailUrl: thumb, isCached: true };
        }
      }

      return { vdbVideoId: vdbVideo.id, title: vidTitle, thumbnailUrl: thumb, isCached: false };
    });

    const vdbVideoId = uploadResult.vdbVideoId as string;
    const thumbnailUrl = uploadResult.thumbnailUrl as string | null;

    await step.run("say-upload-done", async () => { await say(pick(UPLOAD_DONE_MSGS)); });

    await setStatus(`Building scene index for ${intent.eventType}...`);

    const indexResult = await step.run("index-scenes", async () => {
      const cached = await db
        .select({ intentIndexIds: videoCache.intentIndexIds })
        .from(videoCache)
        .where(eq(videoCache.vdbVideoId, vdbVideoId))
        .limit(1);

      if (cached.length > 0) {
        const idxIds = cached[0].intentIndexIds as Record<string, string>;
        if (idxIds[intent.eventType]) {
          return { sceneIndexId: idxIds[intent.eventType] };
        }
      }

      const conn = connect(vdbApiKey);
      const coll = await conn.getCollection(collectionId);
      const vdbVideo = await coll.getVideo(vdbVideoId);

      const newIndexId = await vdbVideo.indexVisuals({
        prompt: intent.indexPrompt,
        batchConfig: {
          type: "time",
          value: intent.eventType === "fouls" ? 4 : 6,
          frameCount: 3,
          selectFrames: ["first", "middle", "last"],
        },
        name: `world-cup-${intent.eventType}-${Date.now()}`,
      });

      if (!newIndexId) {
        throw new NonRetriableError("VideoDB indexVisuals did not return a scene index id");
      }

      const existing = await db
        .select({ intentIndexIds: videoCache.intentIndexIds })
        .from(videoCache)
        .where(eq(videoCache.vdbVideoId, vdbVideoId))
        .limit(1);

      if (existing.length > 0) {
        const idxIds = (existing[0].intentIndexIds as Record<string, string>) || {};
        idxIds[intent.eventType] = newIndexId;
        await db
          .update(videoCache)
          .set({ intentIndexIds: idxIds })
          .where(eq(videoCache.vdbVideoId, vdbVideoId));
      }

      return { sceneIndexId: newIndexId };
    });

    const sceneIndexId = indexResult.sceneIndexId as string;

    await setStatus(`Waiting for scene index to build...`);

    let indexReady = false;
    const maxAttempts = 40;
    for (let attempt = 0; attempt < maxAttempts && !indexReady; attempt += 1) {
      const checkResult = await step.run(`check-index-${attempt}`, async () => {
        const conn = connect(vdbApiKey);
        const col = await conn.getCollection(collectionId);
        const vdbVideo = await col.getVideo(vdbVideoId);
        const indexes = await vdbVideo.listSceneIndex();
        const index = indexes.find((item) => item.sceneIndexId === sceneIndexId);
        const status = index?.status?.toLowerCase();

        if (status === "failed") {
          throw new NonRetriableError(
            `VideoDB scene index failed: ${sceneIndexId}`,
          );
        }

        if (!index && attempt >= 5) {
          throw new NonRetriableError(
            `VideoDB scene index ${sceneIndexId} was never listed`,
          );
        }

        return { ready: status === "done" || status === "completed" || status === "ready" };
      });

      if (checkResult.ready) {
        await step.sleep("final-cooldown", 8);
        indexReady = true;
        break;
      }

      await step.sleep(`poll-wait-${attempt}`, 15);
    }

    if (!indexReady) {
      throw new NonRetriableError(
        `VideoDB scene index ${sceneIndexId} did not finish in time (waited ${maxAttempts * 15}s)`,
      );
    }

    await step.run("say-index-ready", async () => { await say(pick(INDEX_READY_MSGS)); });

    await setStatus(`Searching for ${intent.eventType} moments...`);

    const result = await step.run("search-and-compile", async () => {
      const conn = connect(vdbApiKey);
      const col = await conn.getCollection(collectionId);
      const vdbVideo = await col.getVideo(vdbVideoId);

      return searchShotsAndCompileReel(
        vdbVideo,
        sceneIndexId,
        intent,
        topic,
        video,
        knownEvents,
      );
    });

    await step.run("say-search-done", async () => { await say(pick(SEARCH_DONE_MSGS)); });

    await setStatus(`Generating title and match summary...`);

    const summaryResult = await step.run("generate-summary", async () => {
      const conn = connect(vdbApiKey);
      const col = await conn.getCollection(collectionId);
      const vdbVideo = await col.getVideo(vdbVideoId);

      let sceneRecords: Array<{ start: number; end: number; description: string }> = [];
      try {
        sceneRecords = (await vdbVideo.getSceneIndex(sceneIndexId)) as typeof sceneRecords;
      } catch {}

      let sceneText = "";
      if (sceneRecords.length > 0) {
        const formatted = sceneRecords.map((sc) => sc.description);
        sceneText = formatted.join("\n");
      }

      const compiledEvents = (result.events || []).map((e, i) => `${i + 1}. ${e.label}`).join("\n");
      const knownList = (knownEvents || []).map((ke) => `- ${ke.label}${ke.minute ? ` (${ke.minute}')` : ""}${ke.half ? `, ${ke.half} half` : ""}`).join("\n");
      const matchName = video.match || video.title || topic;

      const llmPrompt = `You are a passionate, electric soccer analyst writing a match summary for a World Cup highlights reel. Your tone is that of an excited co-commentator — warm, dramatic, and gripping. You feel every tackle, every roar, every heart-stopping moment. You write like you're narrating the reel to a friend on the couch.

Match: ${matchName}
Request: "${topic}"
Key moments captured (${result.events?.length || 0} clips):
${compiledEvents || "(none)"}
${knownList ? `Researched context:\n${knownList}\n` : ""}
${sceneText ? `Scene-by-scene descriptions from the video:\n${sceneText}\n` : ""}

Return ONLY a JSON object with:
- "title": A punchy, dramatic headline (max 60 chars) that makes a fan want to click. Use team names and the type of moment. No dates.
- "description": One electric line of context (max 100 chars) teasing the drama within.
- "match_summary": 120-170 words of vivid, pulse-racing prose about the moments in this reel. DO NOT mention timestamps, timings, seconds, or frame positions. DO NOT use phrases like "at 00:12" or "between frames". Describe the action, the players, the tension, the stakes. Use short, powerful sentences. Make the reader feel like they're watching it unfold. Sports journalist meets hype commentator. No bullet points, no clinical language, no robotic summaries.

Return only valid JSON, no markdown fences.`;

      try {
        const data = await llmGenerateJson(llmPrompt);
        if (!data) throw new Error("Failed to generate summary");
        return {
          title: (data.title as string) || topic,
          description: (data.description as string) || "",
          matchSummary: (data.match_summary as string) || result.summary,
        };
      } catch {
        return { title: topic, description: "", matchSummary: result.summary };
      }
    });

    await step.run("say-done", async () => { await say(pick(DONE_MSGS)); });

    const saveResult = await step.run("save-result", async () => {
      await db
        .update(runs)
        .set({
          status: "completed",
          mode: result.mode,
          topic: summaryResult.title,
          selectedVideo: result.selectedVideo ?? null,
          streamUrl: result.streamUrl ?? null,
          playerUrl: result.playerUrl ?? null,
          thumbnailUrl: result.thumbnailUrl ?? thumbnailUrl,
          events: result.events ?? null,
          summary: summaryResult.matchSummary,
          statusMessage: null,
          completedAt: new Date(),
        })
        .where(eq(runs.id, runId));

      return { notifyChannel, notifyConfig };
    });

    // Only scheduled runs have notifyConfig populated.
    // Credentials are plaintext from the DB (channel_config JSONB).
    // Plaintext credentials must never be logged.
    await step.run("send-notifications", async () => {
      const config = payload.notifyConfig as {
        telegram?: { botToken: string; chatId: string };
        discord?: { webhookUrl: string };
        slack?: { webhookUrl: string };
      } | undefined;

      if (!config) return { skipped: true };

      const [row] = await db
        .select({
          query: runs.query,
          topic: runs.topic,
          playerUrl: runs.playerUrl,
          events: runs.events,
          summary: runs.summary,
          thumbnailUrl: runs.thumbnailUrl,
          status: runs.status,
        })
        .from(runs)
        .where(eq(runs.id, runId))
        .limit(1);

      if (!row || row.status !== "completed") return { skipped: true };

      await sendRunNotification(config, {
        runId,
        query: row.query,
        topic: row.topic,
        playerUrl: row.playerUrl ?? "",
        events: (row.events as BriefingEvent[]) ?? [],
        summary: row.summary,
        thumbnailUrl: row.thumbnailUrl,
      });

      return { notified: true };
    });

    return { status: "completed", runId, notifyChannel: saveResult.notifyChannel, notifyConfig: saveResult.notifyConfig };
  },
);

export const checkSchedules = inngest.createFunction(
  {
    id: "check-schedules",
    name: "Check Schedules",
    triggers: [{ cron: "* * * * *" }],
  },
  async ({ step }) => {
    const due = await step.run("query-due-schedules", async () => {
      const now = new Date();
      return db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.isActive, true),
            lte(schedules.nextRunAt, now),
          ),
        )
        .orderBy(asc(schedules.nextRunAt))
        .limit(50);
    });

    for (const schedule of due) {
      const scheduleId = schedule.id;

      await step.run(`dispatch-schedule-${scheduleId}`, async () => {
        const tfApiKey = decrypt(schedule.tfApiKeyEnc);
        const vdbApiKey = decrypt(schedule.vdbApiKeyEnc);
        const runId = randomUUID();

        let agentResult;
        try {
          agentResult = await createAgentPipeline({
            prompt: schedule.query,
            tfApiKey,
          });
        } catch (err) {
          agentResult = null;
          logger.error({ err, scheduleId, query: schedule.query }, "checkSchedules: agent pipeline crashed, falling back to direct search");
        }

        let selectedVideo: VideoCandidate | null =
          agentResult?.selectedVideo ?? null;
        const knownEvents =
          agentResult?.knownEvents ?? [];

        if (!selectedVideo || (agentResult?.search && agentResult.search.results.length === 0)) {
          logger.warn(
            { query: schedule.query, hasAgentResult: agentResult !== null },
            "checkSchedules: agent found no video candidates, falling back to direct search",
          );
          const fallbackSearch = await searchWorldCupVideos(schedule.query, tfApiKey);
          if (fallbackSearch.results.length > 0) {
            selectedVideo = fallbackSearch.results[0];
            logger.info(
              { query: schedule.query, video: selectedVideo.title },
              "checkSchedules: fallback search found video",
            );
          }
        }

        if (!selectedVideo) {
          logger.error({ query: schedule.query }, "checkSchedules: no video candidates (agent + fallback)");
          await db
            .update(schedules)
            .set({
              lastRunAt: new Date(),
              nextRunAt: computeNextRunAt(schedule.runTime, schedule.timezone),
            })
            .where(eq(schedules.id, scheduleId));
          return;
        }

        await db.insert(runs).values({
          id: runId,
          query: schedule.query,
          topic: agentResult?.topic ?? schedule.query,
          status: "processing",
          mode: "live",
          selectedVideo: selectedVideo as Record<string, unknown>,
          isPublic: false,
          apiKeyHash: schedule.apiKeyHash,
          scheduleId,
          statusMessage: "Building your briefing...",
        });

        await db
          .update(schedules)
          .set({
            lastRunAt: new Date(),
            nextRunAt: computeNextRunAt(schedule.runTime, schedule.timezone),
          })
          .where(eq(schedules.id, scheduleId));

        const cfg = schedule.channelConfig as { channelIds?: string[] };
        const channelIds = Array.isArray(cfg?.channelIds) ? cfg.channelIds : [];
        let notifyChannel = "none";
        const notifyConfig: Record<string, unknown> = {};

        if (channelIds.length > 0) {
          const channelRows = await db
            .select({ id: channels.id, type: channels.type, credentialsEnc: channels.credentialsEnc })
            .from(channels)
            .where(and(eq(channels.apiKeyHash, schedule.apiKeyHash)));

          const channelMap = new Map(channelRows.map((c) => [c.id, c]));
          notifyChannel = channelIds
            .map((cid) => channelMap.get(cid)?.type)
            .filter(Boolean)
            .join(",") || "none";

          for (const cid of channelIds) {
            const ch = channelMap.get(cid);
            if (ch) {
              try {
                notifyConfig[ch.type] = decryptJson(ch.credentialsEnc);
              } catch {}
            }
          }
        }

        try {
          await inngest.send({
            name: "app/reel.create",
            data: {
              runId,
              topic: schedule.query,
              video: selectedVideo,
              knownEvents: knownEvents,
              tfApiKey,
              vdbApiKey,
              apiKeyHash: schedule.apiKeyHash,
              scheduleId,
              notifyChannel,
              notifyConfig,
            },
          });
        } catch {
          await db
            .update(runs)
            .set({
              status: "failed",
              errorMessage: "Failed to dispatch background pipeline",
              statusMessage: "Failed to dispatch pipeline",
              completedAt: new Date(),
            })
            .where(eq(runs.id, runId));
        }
      });
    }

    return { dueCount: due.length };
  },
);
