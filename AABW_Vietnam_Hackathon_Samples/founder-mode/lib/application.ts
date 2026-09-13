import { TinyFish, RunStatus, BrowserProfile } from "@tiny-fish/sdk";
import type { Run } from "@tiny-fish/sdk";
import type { QuestionAnswer, CompanyProfile } from "./types";
import { getVietnamDateString } from "./date";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 360;
const REAL_BROWSER_PROFILE = BrowserProfile.STEALTH;

let _client: TinyFish | null = null;
function getClient(): TinyFish | null {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new TinyFish({ apiKey, timeout: 60_000, maxRetries: 2 });
  return _client;
}

async function pollUntilDone(client: TinyFish, runId: string): Promise<Run | null> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const run = await client.runs.get(runId);
    if (run.status === RunStatus.COMPLETED || run.status === RunStatus.FAILED || run.status === RunStatus.CANCELLED) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}

// --- Step 1: extract the real questions from the actual application form ---

function extractGoal(): string {
  return [
    "You are reading a startup accelerator/grant application form, not filling it out.",
    "Do not create an account, do not sign up, do not enter any information. If the form requires login or account creation before showing questions, stop and report that.",
    "List every question the application asks (e.g. 'What problem are you solving?', 'Team size', 'Monthly revenue'). For each, note its character/word limit if one is shown, otherwise null.",
    "Return JSON matching this exact structure:",
    '{"requires_login": false, "questions": [{"question": "What problem are you solving?", "char_limit": 500}]}',
    "If requires_login is true, questions can be an empty array.",
  ].join(" ");
}

type ExtractedQuestion = { question: string; char_limit: number | null };

export async function extractApplicationQuestions(
  applyUrl: string
): Promise<{ questions: ExtractedQuestion[]; requiresLogin: boolean } | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const queued = await client.agent.queue({ url: applyUrl, goal: extractGoal(), browser_profile: REAL_BROWSER_PROFILE });
    if (queued.error || !queued.run_id) {
      console.error("TinyFish queue failed for extraction:", queued.error?.message);
      return null;
    }
    const run = await pollUntilDone(client, queued.run_id);
    if (!run || run.status !== RunStatus.COMPLETED) {
      console.error(`Extraction run failed: [${run?.error?.category}] ${run?.error?.message}`);
      return null;
    }
    const result = run.result as any;
    if (!result || !Array.isArray(result.questions)) return null;
    return { questions: result.questions, requiresLogin: Boolean(result.requires_login) };
  } catch (err) {
    console.error("Extraction error:", err);
    return null;
  }
}

// --- Step 2: draft answers with Groq, using the company profile ---

export async function draftAnswers(
  questions: ExtractedQuestion[],
  profile: CompanyProfile
): Promise<QuestionAnswer[]> {
  const apiKey = process.env.GROQ_API_KEY;
  const fallback = () =>
    questions.map((q, i) => ({
      id: `q-${i}`,
      question: q.question,
      charLimit: q.char_limit,
      draft: "",
      edited: false,
    }));

  if (!apiKey) return fallback();

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: [
              "You are a startup founder's applications assistant, writing draft answers for an accelerator/grant application.",
              "Use only the company information given — never invent traction numbers, team size, or facts not provided. If a fact needed to answer well isn't in the company profile, write a reasonable placeholder in [brackets] noting what's missing, rather than fabricating it.",
              "Respect each question's character limit if given.",
              "Write in a clear, confident, specific founder voice — no generic startup buzzwords, no filler.",
              'Respond with ONLY a raw JSON array, no prose: [{"question": "...", "draft": "..."}], one item per question given, in the same order.',
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({ company: profile, questions: questions.map((q) => q.question) }),
          },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) return fallback();
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length !== questions.length) return fallback();

    return questions.map((q, i) => ({
      id: `q-${i}`,
      question: q.question,
      charLimit: q.char_limit,
      draft: typeof parsed[i]?.draft === "string" ? parsed[i].draft : "",
      edited: false,
    }));
  } catch (err) {
    console.error("Drafting error:", err);
    return fallback();
  }
}

// --- Step 3: fill the real form with the (possibly human-edited) answers, and submit ---
// Per an explicit decision: this is a test/pre-production phase, so the
// agent is allowed to actually submit rather than just stage the fill.

function fillGoal(answers: QuestionAnswer[], todayStr: string): string {
  const qa = answers.map((a) => `Q: "${a.question}" A: "${a.draft.replace(/"/g, "'")}"`).join(" | ");
  return [
    `Today's date is ${todayStr} (Vietnam local time, UTC+7).`,
    "You are filling out a real startup accelerator/grant application form using the answers provided below.",
    "Do not create a new account or sign up for anything not already accessible. If the form requires login/account creation you don't have credentials for, stop and report that instead of inventing an account.",
    "Match each answer to its corresponding question field on the form as closely as possible. If a field isn't covered by the provided answers, leave it blank rather than inventing content.",
    `Answers to use: ${qa}`,
    "Once all matching fields are filled, submit the form.",
    'Return JSON: {"submitted": true, "confirmation_note": "short note on what happened"} or {"submitted": false, "confirmation_note": "why not"}.',
  ].join(" ");
}

export async function fillAndSubmitApplication(
  applyUrl: string,
  answers: QuestionAnswer[]
): Promise<{ submitted: boolean; note: string } | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const queued = await client.agent.queue({
      url: applyUrl,
      goal: fillGoal(answers, getVietnamDateString()),
      browser_profile: REAL_BROWSER_PROFILE,
    });
    if (queued.error || !queued.run_id) {
      console.error("TinyFish queue failed for fill/submit:", queued.error?.message);
      return null;
    }
    const run = await pollUntilDone(client, queued.run_id);
    if (!run || run.status !== RunStatus.COMPLETED) {
      console.error(`Fill/submit run failed: [${run?.error?.category}] ${run?.error?.message}`);
      return null;
    }
    const result = run.result as any;
    return {
      submitted: Boolean(result?.submitted),
      note: typeof result?.confirmation_note === "string" ? result.confirmation_note : "No confirmation details returned.",
    };
  } catch (err) {
    console.error("Fill/submit error:", err);
    return null;
  }
}
