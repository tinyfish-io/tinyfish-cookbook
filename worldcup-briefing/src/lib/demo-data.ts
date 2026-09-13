export type VideoCandidate = {
  id: string;
  title: string;
  url: string;
  source: string;
  duration: string;
  teams: string[];
  match: string;
  videoType: "match highlights" | "press conference" | "analysis" | "fan reaction";
  confidence: number;
};

export type BriefingEvent = {
  label: string;
  timestamp: string;
  query: string;
  clipUrl: string;
};

export type BriefingPayload = {
  runId: string;
  status: "completed";
  mode?: "demo" | "live" | "live-error";
  error?: string;
  topic: string;
  selectedVideo: VideoCandidate;
  streamUrl: string;
  playerUrl: string;
  thumbnailUrl?: string;
  events: BriefingEvent[];
  summary: string;
  integration: {
    tinyfish: string;
    videodb: string;
  };
};

export const demoVideos: VideoCandidate[] = [
  {
    id: "usa-paraguay-highlights",
    title: "USA vs Paraguay | FIFA World Cup 2026 Group Stage Highlights",
    url: "https://www.youtube.com/watch?v=QK_9C81hkxk",
    source: "FOX Sports",
    duration: "12:48",
    teams: ["USA", "Paraguay"],
    match: "USA vs Paraguay",
    videoType: "match highlights",
    confidence: 0.94,
  },
  {
    id: "brazil-morocco-preview",
    title: "Brazil vs Morocco tactical preview and squad news",
    url: "https://www.youtube.com/watch?v=BGNUEdyqqy0",
    source: "World Soccer Desk",
    duration: "18:21",
    teams: ["Brazil", "Morocco"],
    match: "Brazil vs Morocco",
    videoType: "analysis",
    confidence: 0.89,
  },
  {
    id: "mexico-south-africa-post",
    title: "Mexico vs South Africa post-match reactions from the opener",
    url: "https://www.youtube.com/watch?v=03GHLDzOHdE",
    source: "FIFA Fan Zone",
    duration: "9:16",
    teams: ["Mexico", "South Africa"],
    match: "Mexico vs South Africa",
    videoType: "fan reaction",
    confidence: 0.86,
  },
  {
    id: "canada-bosnia-press",
    title: "Canada press conference before Bosnia & Herzegovina clash",
    url: "https://www.youtube.com/watch?v=NXhsRhi4fjo",
    source: "CBC Sports",
    duration: "22:04",
    teams: ["Canada", "Bosnia & Herzegovina"],
    match: "Canada vs Bosnia & Herzegovina",
    videoType: "press conference",
    confidence: 0.82,
  },
];

export function searchDemoVideos(query: string) {
  const normalized = query.toLowerCase();
  const ranked = demoVideos
    .map((video) => {
      const haystack = [
        video.title,
        video.source,
        video.match,
        video.videoType,
        ...video.teams,
      ]
        .join(" ")
        .toLowerCase();

      const queryBoost = normalized
        .split(/\s+/)
        .filter(Boolean)
        .reduce((score, token) => score + (haystack.includes(token) ? 0.02 : 0), 0);

      return {
        ...video,
        confidence: Math.min(0.99, Number((video.confidence + queryBoost).toFixed(2))),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return ranked;
}

export function buildDemoBriefing(topic: string, selectedVideo: VideoCandidate): BriefingPayload {
  const slug = selectedVideo.id.slice(0, 18);

  return {
    runId: `tf-wc-${Date.now().toString(36)}`,
    status: "completed",
    mode: "demo",
    topic,
    selectedVideo,
    streamUrl: "https://play.videodb.io/v1/43570285-1d6e-4548-86e6-294201d2418f.m3u8",
    playerUrl:
      "https://player.videodb.io/watch?v=https://play.videodb.io/v1/43570285-1d6e-4548-86e6-294201d2418f.m3u8",
    events: [
      {
        label: "Opening pressure",
        timestamp: "08:14",
        query: "chance near penalty box",
        clipUrl: `https://play.videodb.io/v1/${slug}-chance.m3u8`,
      },
      {
        label: "Penalty area scramble",
        timestamp: "31:42",
        query: "shot attempt crowded box",
        clipUrl: `https://play.videodb.io/v1/${slug}-scramble.m3u8`,
      },
      {
        label: "Card incident",
        timestamp: "57:09",
        query: "yellow card referee",
        clipUrl: `https://play.videodb.io/v1/${slug}-card.m3u8`,
      },
      {
        label: "Late reaction",
        timestamp: "84:18",
        query: "crowd celebration reaction",
        clipUrl: `https://play.videodb.io/v1/${slug}-reaction.m3u8`,
      },
    ],
    summary:
      "TinyFish discovered candidate World Cup video coverage and returned structured metadata. VideoDB ingested the selected source, indexed visual scenes, searched for match events, and generated a playable briefing stream.",
    integration: {
      tinyfish: "Search or browser agent returns video URLs, metadata, teams, match, and content type.",
      videodb:
        "Upload URL, index scenes with a soccer-event prompt, search event queries, compile results into stream URLs.",
    },
  };
}

function extractDuration(text: string) {
  return text.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] || "unknown";
}

function classifyVideoType(text: string): VideoCandidate["videoType"] {
  const value = text.toLowerCase();
  if (value.includes("press conference") || value.includes("press")) {
    return "press conference";
  }
  if (value.includes("reaction") || value.includes("fan")) {
    return "fan reaction";
  }
  if (value.includes("preview") || value.includes("analysis") || value.includes("tactical")) {
    return "analysis";
  }
  return "match highlights";
}

export function candidateFromSearchResult(result: {
  position: number;
  site_name: string;
  snippet: string;
  title: string;
  url: string;
}, query = ""): VideoCandidate {
  const text = `${result.title} ${result.snippet}`;
  const normalizedText = text.toLowerCase();
  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2 && !["youtube", "video"].includes(token));
  const type = classifyVideoType(text);
  const titleTeams = result.title
    .replace(/\|.*/, "")
    .split(/\s+v(?:s|\.)?\s+|\s+-\s+/i)
    .map((team) => team.replace(/full match|highlights|fifa world cup 2026/gi, "").trim())
    .filter((team) => team.length > 2)
    .slice(0, 2);
  const teams = titleTeams.length === 2 ? titleTeams : ["World Cup", "Opponent"];

  const queryScore = queryTokens.reduce(
    (score, token) => score + (normalizedText.includes(token) ? 0.025 : 0),
    0,
  );
  const highlightBoost =
    type === "match highlights" && /highlight|full match|goal/i.test(text) ? 0.12 : 0;
  const exactMatchBoost =
    teams.length === 2 && teams.every((team) => query.toLowerCase().includes(team.toLowerCase()))
      ? 0.08
      : 0;
  const fullMatchBoost = /full match|full game|90 min|first half|second half/i.test(text) ? 0.15 : 0;
  const extendedBoost = /extended highlights/i.test(text) ? 0.10 : 0;
  const shortPenalty = /#shorts|\/shorts\//i.test(text) ? -0.25 : 0;
  const noisePenalty = /press conference|reaction|analysis|preview|talking head/i.test(text) ? -0.10 : 0;

  return {
    id: `tf-${result.position}-${result.url.split("v=").at(-1)?.slice(0, 12) || result.position}`,
    title: result.title,
    url: result.url,
    source: result.site_name.replace(/^www\./, ""),
    duration: extractDuration(text),
    teams,
    match: teams.join(" vs "),
    videoType: type,
    confidence: Number(
      Math.min(
        0.99,
        Math.max(0.50, 0.74 - result.position * 0.025 + queryScore + highlightBoost + exactMatchBoost + fullMatchBoost + extendedBoost + shortPenalty + noisePenalty),
      ).toFixed(2),
    ),
  };
}
