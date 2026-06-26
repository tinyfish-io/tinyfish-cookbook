import { TinyFish } from "@tiny-fish/sdk";
import { connect, type Connection, type Collection, type Video } from "videodb";
import { normalizeYouTubeUrl } from "@/lib/normalize-url";
import {
  buildDemoBriefing,
  candidateFromSearchResult,
  demoVideos,
  searchDemoVideos,
  type BriefingEvent,
  type BriefingPayload,
  type VideoCandidate,
} from "@/lib/demo-data";

export type SearchResponse = {
  mode: "demo" | "live" | "live-error";
  query: string;
  source: string;
  error?: string;
  results: VideoCandidate[];
};

export type ClipConfig = {
  leadIn: number; // seconds of context before the (possibly backtracked) action
  tail: number; // seconds after the anchor scene so the moment plays out
  backtrack: RegExp; // preceding scenes matching this are part of the same action
  maxBacktrack: number; // hard cap on how far back to walk (seconds)
};

export type BriefingIntent = {
  eventType: string;
  indexPrompt: string;
  searches: [string, string[]][];
  clip: ClipConfig;
};

export type KnownEvent = {
  label: string;
  minute?: number;
  half?: "1st" | "2nd";
};

export type ResearchResult = {
  query: string;
  results: { title: string; url: string; site: string; snippet: string }[];
  pages: { url: string; content: string }[];
  note?: string;
};

export type CandidateShot = {
  videoId?: string;
  sceneIndexId?: string;
  searchScore?: number;
  text?: string;
  start: number;
  end: number;
  generateStream: () => Promise<string>;
};

// The index prompt asks the vision model to append the broadcast clock as
// (MM') when it is readable; pull it back out of the scene description.
export function extractClockMinute(text?: string): number | null {
  if (!text) return null;
  const match = text.match(/\((\d{1,3})'\)/) || text.match(/\b(\d{1,3})'/);
  if (!match) return null;
  const minute = Number(match[1]);
  return minute >= 0 && minute <= 130 ? minute : null;
}

const indexPromptRules = `
You are describing one scene from a football match broadcast. You may be shown multiple frames, but they all belong to a single scene.

Output rules (strict):
- Write exactly ONE description of the scene as a whole, in 1-2 plain sentences.
- Never mention frames, images, screenshots, scenes, or that you are analyzing a video.
- No numbering, no bullet points, no headings, no quotes, no meta commentary.
- If the scene is not match play (studio, tunnel, arrivals, ads, replays of crowds), describe it in one short factual sentence, e.g. "Players walk through the tunnel before kickoff."
- Name the action concretely: who has the ball, what happens, where on the pitch.
- If the broadcast scoreboard match clock is readable in any frame, append the match minute at the very end of the description in the exact form (MM') — for example (63'). If no clock is readable, append nothing.
`;

export function inferIntent(topic: string): BriefingIntent {
  const value = topic.toLowerCase();

  if (/foul|fouls|tackle|free kick|freekick/.test(value)) {
    return {
      eventType: "fouls",
      indexPrompt: `${indexPromptRules}
Event tagging:
- Start the description with "FOUL:" only when there is visible evidence of a foul or a foul decision: trip, push, shirt pull, handball, late or dangerous tackle, a collision that stops play, a referee whistle or free-kick signal, or players protesting a foul.
- Do not tag normal tackles or shoulder-to-shoulder contact as FOUL unless play stops or the referee reacts.
- For every other scene, write the description with no prefix.
`,
      searches: [
        ["Foul incidents", ["FOUL referee whistle", "foul tackle free kick", "player tripped foul"]],
        ["Physical challenges", ["late challenge", "sliding tackle foul", "shirt pull push"]],
        ["Referee decisions", ["referee stops play", "free kick awarded", "advantage signal"]],
      ],
      clip: {
        leadIn: 5,
        tail: 6,
        backtrack: /foul|tackle|challenge|trip|push|collision|clash/i,
        maxBacktrack: 15,
      },
    };
  }

  if (/card|yellow|red/.test(value)) {
    return {
      eventType: "cards",
      indexPrompt: `${indexPromptRules}
Event tagging — start the description with exactly one of these prefixes, and only when certain:
- "CARD:" a yellow or red card is visibly shown by the referee, or a booking is clearly being signaled.
- "FOUL:" a foul or dangerous challenge that stops play: trip, late tackle, push, collision, players going down, or players confronting each other after a challenge.
For every other scene, write the description with no prefix.
`,
      searches: [
        ["Cards shown", ["CARD yellow red referee", "yellow card shown", "red card shown"]],
        ["Booking aftermath", ["player booked referee", "card incident replay"]],
      ],
      clip: {
        // The card is shown well after the foul (protests, VAR) — walk back
        // through FOUL/confrontation scenes so the viewer sees the offence.
        leadIn: 5,
        tail: 6,
        backtrack: /foul|tackle|challenge|trip|push|collision|clash|down|injur|confront|argu|protest|var|referee/i,
        maxBacktrack: 45,
      },
    };
  }

  if (/penalt|spot kick/.test(value)) {
    return {
      eventType: "penalties",
      indexPrompt: `${indexPromptRules}
Event tagging:
- Start the description with "PENALTY:" only for penalty decisions, penalty kicks, penalty saves, or clear penalty appeals in the box.
- For every other scene, write the description with no prefix.
`,
      searches: [
        ["Penalty moments", ["PENALTY kick decision", "penalty appeal", "spot kick save"]],
        ["Box incidents", ["foul inside box", "handball penalty area"]],
      ],
      clip: {
        leadIn: 6,
        tail: 8,
        backtrack: /foul|handball|box|penalty|var|referee|appeal/i,
        maxBacktrack: 30,
      },
    };
  }

  if (/goal|score|scored|scoring/.test(value)) {
    return {
      eventType: "goals",
      indexPrompt: `${indexPromptRules}
Event tagging — start the description with exactly one of these prefixes, and only when certain:
- "GOAL:" the ball visibly enters the goal or crosses the line — in live play or in a replay. The strike, header, or finish itself.
- "CELEBRATION:" players or crowd celebrating after a goal: hugging, running to the corner, arms raised. Never tag a celebration as GOAL.
- "CHANCE:" a shot, header, or one-on-one that does NOT result in a goal.
For every other scene, write the description with no prefix.
`,
      searches: [
        ["Goals", ["GOAL ball enters the net", "shot scores a goal", "header scores goal"]],
        ["Goal chances", ["CHANCE shot on target", "one-on-one with goalkeeper"]],
      ],
      clip: {
        // Anchor on the finish, then walk back through the build-up so the
        // clip shows the move, not just the net rippling (or worse, only the
        // celebration).
        leadIn: 6,
        tail: 8,
        backtrack: /attack|build|cross|pass|run|dribbl|counter|shot|through|move|possession/i,
        maxBacktrack: 20,
      },
    };
  }

  return {
    eventType: "highlights",
    indexPrompt: `${indexPromptRules}
Event tagging — start the description with exactly one of these prefixes, and only when certain:
- "GOAL:" the ball visibly enters the goal or crosses the line — in live play or in a replay. Never tag a celebration as GOAL.
- "CHANCE:" an attacking move, shot, header, scramble, or one-on-one near the penalty area.
- "PENALTY:" a penalty kick or penalty decision.
- "CARD:" a yellow or red card is shown.
- "CELEBRATION:" players or crowd celebrating an important moment.
For every other scene, write the description with no prefix.
`,
    searches: [
      ["Goals", ["GOAL ball enters the net", "shot scores a goal"]],
      ["Chances", ["CHANCE shot attempt", "goal scoring chance", "attacking move penalty area"]],
      ["Key moments", ["PENALTY kick decision", "CARD shown by referee"]],
    ],
    clip: {
      leadIn: 6,
      tail: 8,
      backtrack: /attack|build|cross|pass|run|dribbl|counter|shot|through|move/i,
      maxBacktrack: 20,
    },
  };
}

function toPlayerUrl(streamUrl: string) {
  return `https://player.videodb.io/watch?v=${encodeURIComponent(streamUrl)}`;
}

export async function getOrCreateCollection(
  conn: Connection,
  name: string,
): Promise<Collection> {
  const collections = await conn.getCollections();
  const existing = collections.find((c) => c.name === name);
  if (existing) return existing;
  return conn.createCollection(name, "Auto-created by World Cup Briefing App");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchWorldCupVideos(
  query: string,
  tfApiKey?: string,
): Promise<SearchResponse> {
  const effectiveKey = tfApiKey || process.env.TINYFISH_API_KEY;
  if (effectiveKey) {
    try {
      const client = new TinyFish({
        apiKey: effectiveKey,
        timeout: 30_000,
        maxRetries: 1,
      });
      const response = await client.search.query({
        query: `football "${query}" ("full match" OR "extended highlights" OR "match highlights") site:youtube.com`,
      });
      const results = response.results
        .filter((result) => normalizeYouTubeUrl(result.url) !== null)
        .map((result) => candidateFromSearchResult(result, query))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 6);

      return {
        mode: "live",
        query,
        source: "TinyFish Search API",
        results: results.length > 0 ? results : searchDemoVideos(query),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      const isAuth =
        msg.includes("Invalid or expired API key") ||
        msg.includes("Authentication") ||
        msg.includes("401") ||
        msg.includes("403");
      return {
        mode: "live-error",
        query,
        source: "TinyFish Search API",
        error: error instanceof Error ? error.message : "TinyFish search failed",
        results: isAuth ? [] : searchDemoVideos(query),
      };
    }
  }

  return {
    mode: "demo",
    query,
    source: "TinyFish discovery layer",
    results: searchDemoVideos(query),
  };
}

export async function researchMatchInfo(
  query: string,
  tfApiKey?: string,
): Promise<ResearchResult> {
  const effectiveKey = tfApiKey || process.env.TINYFISH_API_KEY;
  if (!effectiveKey) {
    return {
      query,
      results: [],
      pages: [],
      note: "TINYFISH_API_KEY is not configured; research is unavailable in demo mode.",
    };
  }

  const client = new TinyFish({
    apiKey: effectiveKey,
    timeout: 30_000,
    maxRetries: 1,
  });

  const response = await client.search.query({ query });
  const results = response.results.slice(0, 6).map((result) => ({
    title: result.title,
    url: result.url,
    site: result.site_name,
    snippet: result.snippet,
  }));

  // Read the top pages so the agent can pull exact minutes and player names
  // out of match reports and live-commentary timelines.
  let pages: ResearchResult["pages"] = [];
  if (results.length) {
    try {
      const fetched = await client.fetch.getContents({
        urls: results.slice(0, 3).map((result) => result.url),
        format: "markdown",
      });
      pages = fetched.results
        .map((page) => ({
          url: page.url,
          content: ("text" in page && typeof page.text === "string" ? page.text : "").slice(
            0,
            3500,
          ),
        }))
        // Pages shorter than this are usually cookie walls or paywalls,
        // not match reports.
        .filter((page) => page.content.length >= 400)
        .slice(0, 2);
    } catch {
      // Snippets alone are still useful; don't fail the research call.
    }
  }

  return { query, results, pages };
}

export async function discoverVideo(topic: string) {
  const search = await searchWorldCupVideos(`${topic} full match highlights`);
  return search.results[0] || searchDemoVideos(topic)[0] || demoVideos[0];
}

async function waitForSceneIndex(video: Video, sceneIndexId: string) {
  // Indexing a full highlight video can take a couple of minutes; the index
  // may also not appear in listSceneIndex immediately after creation.
  const maxAttempts = 40;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const indexes = await video.listSceneIndex();
    const index = indexes.find((item) => item.sceneIndexId === sceneIndexId);
    const status = index?.status?.toLowerCase();

    if (status === "done" || status === "completed" || status === "ready") {
      // Docs: the index can take an extra 5-10s to become searchable after "done".
      await sleep(8000);
      return;
    }

    if (status === "failed") {
      throw new Error(`VideoDB scene index failed: ${sceneIndexId}`);
    }

    if (!index && attempt >= 5) {
      throw new Error(`VideoDB scene index ${sceneIndexId} was never listed for video ${video.id}`);
    }

    await sleep(10000);
  }

  throw new Error(`VideoDB scene index ${sceneIndexId} did not finish in time`);
}

function overlaps(a: [number, number], b: [number, number]) {
  return a[0] < b[1] && b[0] < a[1];
}

function formatTimestamp(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = `${m}`.padStart(2, "0");
  const ss = `${s}`.padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function searchScenes(
  video: Video,
  sceneIndexId: string,
  query: string,
): Promise<CandidateShot[]> {
  // Search must be scoped to the video: Collection.search silently ignores
  // sceneIndexId and returns shots from other videos in the collection.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await video.search(query, "semantic", "scene", 8, 0.25);
      return (result.shots as CandidateShot[]).filter(
        (shot) =>
          (!shot.videoId || shot.videoId === video.id) &&
          (!shot.sceneIndexId || shot.sceneIndexId === sceneIndexId),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/no results/i.test(message)) return [];
      if (attempt === 0) {
        await sleep(4000);
        continue;
      }
      throw error;
    }
  }
  return [];
}

const MAX_MOMENTS_PER_LABEL = 3;
const MAX_TOTAL_MOMENTS = 8;
const MIN_CLIP_LENGTH = 12;
const MAX_CLIP_LENGTH = 60;

type SceneRecord = { start: number; end: number; description: string };

// The search anchors on the most distinctive scene (card being shown, the
// celebration), but the action the viewer wants starts earlier. Walk back
// through the preceding scene descriptions while they describe the same
// passage of play (foul/VAR for cards, build-up for goals).
function backtrackStart(anchorStart: number, records: SceneRecord[], clip: ClipConfig): number {
  let from = anchorStart;
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const record = records[i];
    if (record.end > from + 0.5) continue; // only scenes strictly before the window
    if (anchorStart - record.start > clip.maxBacktrack) break;
    if (!clip.backtrack.test(record.description || "")) break;
    from = record.start;
  }
  return from;
}

function padClip(
  start: number,
  end: number,
  videoLength: number,
  clip: ClipConfig,
): [number, number] {
  let from = Math.max(0, start - clip.leadIn);
  let to = end + clip.tail;
  if (to - from < MIN_CLIP_LENGTH) to = from + MIN_CLIP_LENGTH;
  // When over budget, trim the oldest backtracked context — the anchor
  // moment (card shown, ball in net) must stay in the clip.
  if (to - from > MAX_CLIP_LENGTH) from = to - MAX_CLIP_LENGTH;
  if (videoLength > 0) {
    to = Math.min(to, videoLength);
    from = Math.max(0, Math.min(from, to - 1));
  }
  return [from, to];
}

function mergeTimelines(timelines: [number, number][]): [number, number][] {
  const sorted = [...timelines].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

type PooledShot = { shot: CandidateShot; label: string; query: string };

export async function searchShotsAndCompileReel(
  video: Video,
  sceneIndexId: string,
  intent: BriefingIntent,
  topic: string,
  selectedVideo: VideoCandidate,
  knownEvents?: KnownEvent[],
  onProgress?: (stage: string) => void,
): Promise<BriefingPayload> {
  onProgress?.(`Searching scenes for ${intent.eventType}`);
  const pool: PooledShot[] = [];
  const searchPlans: [string, string[]][] = [...intent.searches];
  for (const event of knownEvents || []) {
    searchPlans.push([event.label, [event.label]]);
  }
  for (const [label, queries] of searchPlans) {
    for (const query of queries) {
      const shots = await searchScenes(video, sceneIndexId, query);
      for (const shot of shots) {
        pool.push({ shot, label, query });
      }
    }
  }

  let chosen: PooledShot[] = [];
  let misses: string[] = [];

  if (knownEvents?.length) {
    const ordered = [...knownEvents].sort(
      (a, b) => (a.minute ?? Number.MAX_SAFE_INTEGER) - (b.minute ?? Number.MAX_SAFE_INTEGER),
    );
    let lastStart = -1;
    for (const event of ordered.slice(0, MAX_TOTAL_MOMENTS)) {
      let best: PooledShot | null = null;
      let bestScore = 0.3;
      for (const candidate of pool) {
        const start = Number(candidate.shot.start);
        if (event.minute !== undefined && start <= lastStart) continue;
        if (
          chosen.some((picked) =>
            overlaps(
              [start, Number(candidate.shot.end)],
              [Number(picked.shot.start), Number(picked.shot.end)],
            ),
          )
        ) {
          continue;
        }
        let score = candidate.shot.searchScore || 0;
        const clock = extractClockMinute(candidate.shot.text);
        if (clock !== null && event.minute !== undefined) {
          score += Math.max(0, 1 - Math.abs(clock - event.minute) / 10) * 0.8;
        }
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      if (best) {
        chosen.push({ ...best, label: event.label });
        if (event.minute !== undefined) lastStart = Number(best.shot.start);
      } else {
        misses.push(event.label);
      }
    }
  }

  if (!chosen.length) {
    const perLabel = new Map<string, number>();
    misses = [];
    for (const candidate of pool.sort(
      (a, b) => (b.shot.searchScore || 0) - (a.shot.searchScore || 0),
    )) {
      if (chosen.length >= MAX_TOTAL_MOMENTS) break;
      if ((perLabel.get(candidate.label) || 0) >= MAX_MOMENTS_PER_LABEL) continue;
      const span: [number, number] = [Number(candidate.shot.start), Number(candidate.shot.end)];
      if (
        chosen.some((picked) =>
          overlaps(span, [Number(picked.shot.start), Number(picked.shot.end)]),
        )
      ) {
        continue;
      }
      chosen.push(candidate);
      perLabel.set(candidate.label, (perLabel.get(candidate.label) || 0) + 1);
    }
    misses = intent.searches
      .map(([label]) => label)
      .filter((label) => !perLabel.has(label));
  }
  chosen = chosen.sort((a, b) => Number(a.shot.start) - Number(b.shot.start));

  onProgress?.("Compiling the highlight reel");
  let sceneRecords: SceneRecord[] = [];
  try {
    const records = (await video.getSceneIndex(sceneIndexId)) as SceneRecord[];
    sceneRecords = [...records].sort((a, b) => a.start - b.start);
  } catch {
    // Backtracking is an enhancement; blind lead-in padding still applies.
  }

  const timelines: [number, number][] = [];
  const events: BriefingEvent[] = [];
  for (const { shot, label, query } of chosen) {
    const start = Math.max(0, Number(shot.start));
    const end = Math.max(start + 1, Number(shot.end));
    const actionStart = backtrackStart(start, sceneRecords, intent.clip);
    timelines.push(padClip(actionStart, end, video.length, intent.clip));
    events.push({
      label,
      timestamp: formatTimestamp(start),
      query,
      clipUrl: await shot.generateStream(),
    });
  }

  const reelTimelines = mergeTimelines(timelines);
  const fallbackEnd = video.length > 0 ? Math.min(video.length, 60) : 60;
  const streamUrl = reelTimelines.length
    ? await video.generateStream(reelTimelines)
    : await video.generateStream([[0, fallbackEnd]]);

  return {
    runId: crypto.randomUUID(),
    status: "completed",
    mode: "live",
    topic,
    selectedVideo: {
      ...selectedVideo,
      title: video.name || selectedVideo.title,
      duration:
        video.length > 0 ? `${Math.round(video.length / 60)} min` : selectedVideo.duration,
    },
    streamUrl,
    playerUrl: toPlayerUrl(streamUrl),
    thumbnailUrl: video.thumbnail || undefined,
    events,
    summary:
      events.length
        ? `VideoDB uploaded the selected video, indexed scenes for ${intent.eventType}, and compiled ${events.length} matching moments into a reel.`
        : `VideoDB uploaded and indexed the selected video, but the ${intent.eventType} search did not find high-confidence moments. The stream falls back to the opening segment.`,
    integration: {
      tinyfish: "TinyFish discovered the source video from the user's natural-language request.",
      videodb: `Uploaded video ${video.id}, scene index ${sceneIndexId || "created"}, compiled ${events.length} event clips${
        misses.length ? `, missed: ${misses.join(", ")}` : ""
      }.`,
    },
  };
}

export async function runVideoDbBriefing(
  topic: string,
  selectedVideo: VideoCandidate,
  onProgress?: (stage: string) => void,
  knownEvents?: KnownEvent[],
  vdbApiKey?: string,
): Promise<BriefingPayload> {
  const apiKey = vdbApiKey || process.env.VIDEO_DB_API_KEY;
  if (!apiKey) {
    throw new Error("VIDEO_DB_API_KEY is not configured");
  }

  const conn = connect(apiKey);
  const coll = await getOrCreateCollection(conn, "world-cup-briefing");
  const intent = inferIntent(topic);

  onProgress?.("Uploading source video to VideoDB");
  const uploaded = await coll.uploadURL({
    url: selectedVideo.url,
    name: selectedVideo.title,
    mediaType: "video",
  });

  if (!uploaded || !("indexVisuals" in uploaded)) {
    throw new Error("VideoDB upload did not return a video object");
  }

  const video = uploaded as Video;
  onProgress?.("Indexing visual scenes — this takes a minute or two");
  const sceneIndexId = await video.indexVisuals({
    prompt: intent.indexPrompt,
    batchConfig: {
      type: "time",
      value: intent.eventType === "fouls" ? 4 : 6,
      frameCount: 3,
      selectFrames: ["first", "middle", "last"],
    },
    name: `world-cup-${intent.eventType}-${Date.now()}`,
  });
  if (!sceneIndexId) {
    throw new Error("VideoDB indexVisuals did not return a scene index id");
  }
  await waitForSceneIndex(video, sceneIndexId);

  return searchShotsAndCompileReel(
    video,
    sceneIndexId,
    intent,
    topic,
    selectedVideo,
    knownEvents,
    onProgress,
  );
}

export async function buildLiveOrFallbackBriefing(
  topic: string,
  selectedVideo?: VideoCandidate,
  onProgress?: (stage: string) => void,
  knownEvents?: KnownEvent[],
  vdbApiKey?: string,
) {
  const video = selectedVideo || (await discoverVideo(topic));

  try {
    return await runVideoDbBriefing(topic, video, onProgress, knownEvents, vdbApiKey);
  } catch (error) {
    return {
      ...buildDemoBriefing(topic, video),
      mode: "live-error" as const,
      error: error instanceof Error ? error.message : "VideoDB processing failed",
    };
  }
}
