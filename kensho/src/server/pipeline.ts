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

const g = globalThis as unknown as { __kenshoRunning?: Set<string> };
const running = (g.__kenshoRunning ??= new Set<string>());

// Two at a time keeps free-tier keys under their requests-per-minute limit.
const CHAPTER_CONCURRENCY = 2;

function newJob(paperId: string): Job {
  return { paperId, stage: "queued", message: "Queued", log: [], chaptersDone: 0, chaptersTotal: 0, error: null, updatedAt: new Date().toISOString() };
}

export function getState(paperId: string): ProcessedPaper | null {
  const paper = getPaper(paperId);
  if (!paper) return null;
  const p = getProcessed(paperId);
  let job = getJob(paperId);
  // A job that was mid-flight when the server restarted is no longer running.
  if (job && !running.has(paperId) && !["done", "error", "queued"].includes(job.stage)) {
    job = { ...job, stage: "error", error: "Processing was interrupted. Start again to resume.", message: "Interrupted" };
  }
  return { paper, ...p, job };
}

export function startProcessing(paperId: string, opts: { restart?: boolean } = {}): Job {
  if (!llmConfigured()) throw new Error("GEMINI_API_KEY is not configured on the server, so papers cannot be turned into manga yet.");
  if (!getPaper(paperId)) throw new Error("Unknown paper.");
  const existing = getJob(paperId);
  if (running.has(paperId) && existing) return existing;
  if (opts.restart) saveProcessed(paperId, { acquisition: null, analysis: null, story: null });
  const job = newJob(paperId);
  saveJob(job);
  running.add(paperId);
  run(paperId, job).finally(() => running.delete(paperId));
  return job;
}

async function run(paperId: string, job: Job) {
  const update = (patch: Partial<Job>, logText?: string) => {
    Object.assign(job, patch);
    if (logText) job.log = [...job.log, { at: new Date().toISOString(), text: logText }].slice(-40);
    saveJob(job);
  };

  try {
    const paper = getPaper(paperId)!;
    let { acquisition, analysis, story } = getProcessed(paperId);

    if (!acquisition) {
      update({ stage: "acquiring", message: "Retrieving the paper with TinyFish" }, "Looking for the full text");
      acquisition = await acquire(paper, (t) => update({}, t));
      upsertPaper({ ...paper, availability: acquisition.mode === "full_text" ? "full_text" : "abstract_only", availabilityConfirmed: true });
      saveProcessed(paperId, { acquisition });
    }

    if (!analysis) {
      update({ stage: "analyzing", message: "Reading and extracting the research" }, `Analysing ${acquisition.sections.length} section(s)`);
      analysis = await analyze(getPaper(paperId)!, acquisition, (m) => update({}, `Model: ${m}`));
      const verified = analysis.claims.filter((c) => c.verified).length;
      update({}, `Extracted ${analysis.claims.length} claims (${verified} quotes verified against the text)`);
      saveProcessed(paperId, { analysis, model: MODEL });
    }

    const plans = analysis.chapterPlan;
    story = story && story.chapters.length === plans.length ? story : { chapters: plans.map(() => null) };
    saveProcessed(paperId, { story });
    const todo = plans.filter((_, i) => !story!.chapters[i]);
    update({ stage: "drawing", message: "Drawing chapters", chaptersTotal: plans.length, chaptersDone: plans.length - todo.length }, `Storyboarding ${todo.length} chapter(s)`);

    const failures: string[] = [];
    const queue = [...todo];
    const worker = async () => {
      for (let plan = queue.shift(); plan; plan = queue.shift()) {
        try {
          const ch = await drawChapter(getPaper(paperId)!, acquisition!, analysis!, plan, (m) => (m !== MODEL ? update({}, `Chapter ${plan.number} using fallback model ${m}`) : undefined));
          // Re-read so parallel workers don't clobber each other's chapters.
          const cur = getProcessed(paperId).story ?? (story as Story);
          cur.chapters[plan.number - 1] = ch;
          saveProcessed(paperId, { story: cur });
          update({ chaptersDone: cur.chapters.filter(Boolean).length }, `Chapter ${plan.number} inked: “${ch.title}”`);
        } catch (e) {
          failures.push(`Chapter ${plan.number}: ${(e as Error).message}`);
          update({}, `Chapter ${plan.number} failed: ${(e as Error).message.slice(0, 140)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CHAPTER_CONCURRENCY, todo.length) }, worker));

    if (failures.length) {
      update({ stage: "error", error: failures.join(" · "), message: "Some chapters failed — retry to finish them" });
    } else {
      update({ stage: "done", message: "Ready to read" }, "Manga complete");
    }
  } catch (e) {
    update({ stage: "error", error: (e as Error).message, message: "Processing failed" }, `Error: ${(e as Error).message.slice(0, 200)}`);
  }
}
