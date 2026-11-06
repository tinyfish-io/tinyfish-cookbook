// All backend calls live here. Vite proxies /api to the FastAPI server.

// FastAPI sends `detail` as a string (our errors) or a list (validation errors).
function errorMessage(data, fallback) {
  const detail = data?.detail ?? data?.error;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg.replace(/^Value error, /, "")).join("; ");
  }
  return fallback;
}

async function request(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data, fallbackMessage));
  }
  return data;
}

export const analyzeClaim = (claim) =>
  request(
    "/api/analyze",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: claim.trim(),
        max_sources: 5,
      }),
    },
    "Claim analysis failed."
  );

// --- Anonymous visitor identity ("I have seen this too") ---
// The server issues a signed random token the first time we need one. We keep
// it in localStorage (and in memory, in case storage is blocked) and send it
// back in the X-Visitor-Token header.
const VISITOR_KEY = "truthlens_visitor_token";
let memoryToken = null;
let tokenRequest = null;

function readToken() {
  try {
    return localStorage.getItem(VISITOR_KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
}

function saveToken(token) {
  memoryToken = token;
  try {
    if (token) localStorage.setItem(VISITOR_KEY, token);
    else localStorage.removeItem(VISITOR_KEY);
  } catch {
    // Storage unavailable (private mode, blocked). The in-memory copy is used.
  }
}

async function ensureVisitorToken() {
  const existing = readToken();
  if (existing) return existing;

  // Share one request between concurrent callers.
  tokenRequest ??= request("/api/visitor", { method: "POST" }, "Could not start a session.")
    .then((data) => {
      saveToken(data.visitor_token);
      return data.visitor_token;
    })
    .finally(() => {
      tokenRequest = null;
    });
  return tokenRequest;
}

// Like request(), but sends the visitor token. If the server rejects the token
// (401, e.g. the signing secret changed) we get a fresh one and retry once.
// With `optional`, a failure to get a token is ignored and the call is made
// anonymously.
async function visitorRequest(url, options = {}, fallbackMessage, { optional = false } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let token = null;
    try {
      token = await ensureVisitorToken();
    } catch (err) {
      if (!optional) throw err;
    }

    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, ...(token && { "X-Visitor-Token": token }) },
    });

    if (response.status === 401 && token && attempt === 0) {
      saveToken(null);
      continue;
    }

    const data = await response.json();
    if (!response.ok) throw new Error(errorMessage(data, fallbackMessage));
    return data;
  }
  throw new Error(fallbackMessage);
}

// sort: "recent" (newest first) or "seen" (most "I have seen this too" first).
export const fetchCommunityClaims = (page, pageSize, sort = "recent") =>
  visitorRequest(
    `/api/community-claims?page=${page}&page_size=${pageSize}&sort=${encodeURIComponent(sort)}`,
    undefined,
    "Could not load community fact-checks.",
    { optional: true }
  );

// Both resolve with { claim_id, seen_count, seen_by_me }.
export const markClaimSeen = (id) =>
  visitorRequest(
    `/api/community-claims/${id}/seen`,
    { method: "PUT" },
    "Could not save your response."
  );

export const unmarkClaimSeen = (id) =>
  visitorRequest(
    `/api/community-claims/${id}/seen`,
    { method: "DELETE" },
    "Could not undo your response."
  );

// Stores a challenge to a community fact-check. Resolves with
// { challenge_id, status, created_at }.
export const submitChallenge = (id, payload) =>
  visitorRequest(
    `/api/community-claims/${id}/challenges`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Could not submit your challenge."
  );

export const fetchCommunityReport = (id) =>
  request(`/api/community-claims/${id}`, undefined, "Could not load this report.");

// Streams an analysis over Server-Sent Events (POST, so we read the body
// ourselves instead of using EventSource). The backend detects the claim's
// language, so none is sent. Calls onProgress for each pipeline
// stage and resolves with the final report.
export async function analyzeClaimStream(claim, onProgress, signal) {
  const response = await fetch("/api/analyze/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      claim: claim.trim(),
      max_sources: 5,
    }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(errorMessage(data, "Claim analysis failed."));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let report = null;

  function handleFrame(frame) {
    let event = "message";
    let payload = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) payload += line.slice(5).trim();
    }
    if (!payload) return; // keep-alive comment
    const data = JSON.parse(payload);

    if (event === "progress") onProgress?.(data);
    else if (event === "result") report = data;
    else if (event === "error") throw new Error(data.detail || "Claim analysis failed.");
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const frames = buffer.split("\n\n");
    buffer = frames.pop(); // the last piece may be an incomplete frame
    frames.forEach(handleFrame);
  }

  if (!report) throw new Error("The analysis ended unexpectedly. Please try again.");
  return report;
}
