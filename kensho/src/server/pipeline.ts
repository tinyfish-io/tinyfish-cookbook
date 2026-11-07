import "server-only";
import type { Job, ProcessedPaper, Story } from "@/lib/types";
import { getJob, getPaper, getProcessed, saveJob, saveProcessed, upsertPaper } from "./db";
import { acquire } from "./acquire";
import { analyze } from "./analyze";
import { drawChapter } from "./storyboard";
import { MODEL, llmConfigured } from "./llm";

// Orchestrates paper → acquisition → analysis → chapters, persisting after every stage so
// a reader can open chapter 1 while later chapters are still being drawn, and a crash
// resumes from the last finished stage instead of starting over.
//
// On serverless hosts the request that starts a job and the requests that poll it may run on
// different instances, so liveness is judged from the job's last saved update, not from memory.

// Two at a time keeps free-tier keys under their requests-per-minute limit.
const CHAPTER_CONCURRENCY = 2;
// A running job saves at every step; one silent for this long has died (crash, timeout, restart).
const STALE_MS = 8 * 60 * 1000;

const isActive = (job: Job | null) =>
  !!job && !["done", "error"].includes(job.stage) && Date.now() - Date.parse(job.updatedAt) < STALE_MS;

function newJob(paperId: string): Job {
  return { paperId, stage: "queued", message: "Queued", log: [], chaptersDone: 0, chaptersTotal: 0, error: null, updatedAt: new Date().toISOString() };
}

export async function getState(paperId: string): Promise<ProcessedPaper | null> {
  const paper = await getPaper(paperId);
  if (!paper) return null;
  const [p, stored] = await Promise.all([getProcessed(paperId), getJob(paperId)]);
  let job = stored;
  if (job && !["done", "error"].includes(job.stage) && !isActive(job)) {
    job = { ...job, stage: "error", error: "Processing was interrupted. Start again to resume.", message: "Interrupted" };
  }
  return { paper, ...p, job };
}

/**
 * Starts (or resumes) processing. Returns the job right away plus `done`, the promise doing the
 * work — the API route hands it to `after()` so serverless hosts keep running it after the response.
 */
export async function startProcessing(paperId: string, opts: { restart?: boolean } = {}): Promise<{ job: Job; done: Promise<void> }> {
  if (!llmConfigured()) throw new Error("GEMINI_API_KEY is not configured on the server, so papers cannot be turned into manga yet.");
  if (!(await getPaper(paperId))) throw new Error("Unknown paper.");
  const existing = await getJob(paperId);
  if (existing && isActive(existing)) return { job: existing, done: Promise.resolve() };
  if (opts.restart) await saveProcessed(paperId, { acquisition: null, analysis: null, story: null });
  const job = newJob(paperId);
  await saveJob(job);
  return { job, done: run(paperId, job) };
}

async function run(paperId: string, job: Job) {
  // Job snapshots are written in order, so a slow write can never overwrite a newer one.
  let saving = Promise.resolve();
  const update = (patch: Partial<Job>, logText?: string) => {
    Object.assign(job, patch);
    if (logText) job.log = [...job.log, { at: new Date().toISOString(), text: logText }].slice(-40);
    const snapshot = { ...job, log: [...job.log] };
    saving = saving.then(() => saveJob(snapshot)).catch(() => {});
    return saving;
  };
  // Parallel chapter workers update the same story record; serialise those read-modify-writes.
  let storyLock = Promise.resolve();
  const withStoryLock = <T,>(fn: () => Promise<T>) => {
    const next = storyLock.then(fn);
    storyLock = next.then(
      () => {},
      () => {},
    );
    return next;
  };

  try {
    const paper = (await getPaper(paperId))!;
    let { acquisition, analysis, story } = await getProcessed(paperId);

    if (!acquisition) {
      update({ stage: "acquiring", message: "Retrieving the paper with TinyFish" }, "Looking for the full text");
      acquisition = await acquire(paper, (t) => void update({}, t));
      await upsertPaper({ ...paper, availability: acquisition.mode === "full_text" ? "full_text" : "abstract_only", availabilityConfirmed: true });
      await saveProcessed(paperId, { acquisition });
    }

    if (!analysis) {
      update({ stage: "analyzing", message: "Reading and extracting the research" }, `Analysing ${acquisition.sections.length} section(s)`);
      analysis = await analyze((await getPaper(paperId))!, acquisition, (m) => void update({}, `Model: ${m}`));
      const verified = analysis.claims.filter((c) => c.verified).length;
      update({}, `Extracted ${analysis.claims.length} claims (${verified} quotes verified against the text)`);
      await saveProcessed(paperId, { analysis, model: MODEL });
    }

    const plans = analysis.chapterPlan;
    story = story && story.chapters.length === plans.length ? story : { chapters: plans.map(() => null) };
    await saveProcessed(paperId, { story });
    const todo = plans.filter((_, i) => !story!.chapters[i]);
    update({ stage: "drawing", message: "Drawing chapters", chaptersTotal: plans.length, chaptersDone: plans.length - todo.length }, `Storyboarding ${todo.length} chapter(s)`);

    const latestPaper = (await getPaper(paperId))!;
    const failures: string[] = [];
    const queue = [...todo];
    const worker = async () => {
      for (let plan = queue.shift(); plan; plan = queue.shift()) {
        try {
          const ch = await drawChapter(latestPaper, acquisition!, analysis!, plan, (m) => (m !== MODEL ? void update({}, `Chapter ${plan.number} using fallback model ${m}`) : undefined));
          const done = await withStoryLock(async () => {
            const cur = (await getProcessed(paperId)).story ?? (story as Story);
            cur.chapters[plan.number - 1] = ch;
            await saveProcessed(paperId, { story: cur });
            return cur.chapters.filter(Boolean).length;
          });
          update({ chaptersDone: done }, `Chapter ${plan.number} inked: “${ch.title}”`);
        } catch (e) {
          failures.push(`Chapter ${plan.number}: ${(e as Error).message}`);
          update({}, `Chapter ${plan.number} failed: ${(e as Error).message.slice(0, 140)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CHAPTER_CONCURRENCY, todo.length) }, worker));

    if (failures.length) {
      await update({ stage: "error", error: failures.join(" · "), message: "Some chapters failed — retry to finish them" });
    } else {
      await update({ stage: "done", message: "Ready to read" }, "Manga complete");
    }
  } catch (e) {
    await update({ stage: "error", error: (e as Error).message, message: "Processing failed" }, `Error: ${(e as Error).message.slice(0, 200)}`);
  }
}
