import { store } from "./store";
import { runDiscoverySweep, mergeSiteResult } from "./discovery";
import { extractApplicationQuestions, draftAnswers, fillAndSubmitApplication } from "./application";
import type { Application } from "./types";

export async function ensureSeeded() {
  const programs = await store.getPrograms();
  return programs;
}

// Discovery sweep — every 8 hours via GitHub Actions, or manually triggered.
// Scrapes all 6 sources in parallel (see lib/discovery.ts), merges with
// existing programs (real data always wins over seed, and a site that
// transiently fails doesn't wipe out what it found last time).
export async function runDiscoveryAndSave(reason: string) {
  console.log(`[discovery] starting — reason: ${reason}`);
  await store.setMeta({ discoveryStartedAt: new Date().toISOString() });

  const existing = await store.getPrograms();
  const profile = await store.getCompanyProfile();
  const beforeIds = new Set(existing.map((p) => p.id));

  const { programs, agentStatuses } = await runDiscoverySweep(existing, profile, async (site, result, status) => {
    // Persist the moment THIS site finishes — not after all 6 are done —
    // so anyone polling the store (the dashboard, every 8s) sees each
    // agent's results as soon as they're ready, one at a time.
    if (result) {
      const current = await store.getPrograms();
      const merged = mergeSiteResult(site, result, current, profile);
      await store.setPrograms(merged);
    }
    const currentStatuses = await store.getAgentStatuses();
    currentStatuses[site.id] = status;
    await store.setAgentStatuses(currentStatuses);
    console.log(`[discovery] ${site.name} done — ${status.programsFound} programs found`);
  });

  // Final write covers any edge case where the progressive writes above and
  // the in-memory accumulation in runDiscoverySweep diverged slightly.
  await store.setPrograms(programs);
  await store.setAgentStatuses(agentStatuses);
  await store.setMeta({
    lastDiscoveryAt: new Date().toISOString(),
    usingRealAgents: Boolean(process.env.TINYFISH_API_KEY),
  });

  const newCount = programs.filter((p) => !beforeIds.has(p.id)).length;
  return { sitesSwept: Object.keys(agentStatuses).length, newCount, totalPrograms: programs.length };
}

let discoveryBootstrapChecked = false;
export function bootstrapLocalDevIfNeeded() {
  if (process.env.VERCEL) return;
  if (!process.env.TINYFISH_API_KEY) return;
  if (discoveryBootstrapChecked) return;
  discoveryBootstrapChecked = true;

  store.getMeta().then((meta) => {
    if (meta.discoveryStartedAt !== null) return;
    console.log("[bootstrap] first run detected, starting real discovery sweep in the background...");
    runDiscoveryAndSave("local-dev-bootstrap (first ever run)")
      .then(() => console.log("[bootstrap] background discovery complete"))
      .catch((err) => console.error("[bootstrap] background discovery failed:", err));
  });
}

// Called when a program is dragged into the pipeline — creates the
// application and immediately starts extracting + drafting, automatically,
// no pause in between. Stops at "ready" — submission is a separate,
// explicit action (see submitApplication below).
export async function startApplication(programId: string): Promise<Application> {
  const programs = await store.getPrograms();
  const program = programs.find((p) => p.id === programId);
  if (!program) throw new Error("Program not found");

  const applications = await store.getApplications();
  const application: Application = {
    id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    programId: program.id,
    programName: program.name,
    stage: "extracting",
    statusNote: "Reading the real application form...",
    questions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submittedAt: null,
  };
  await store.setApplications([...applications, application]);

  // Fire the rest of the pipeline in the background — the caller (API
  // route) returns immediately with the "extracting" application, and the
  // frontend polls to see it progress through drafting to ready.
  processApplicationPipeline(application.id).catch((err) =>
    console.error(`[application ${application.id}] pipeline failed:`, err)
  );

  return application;
}

async function updateApplication(id: string, patch: Partial<Application>) {
  const applications = await store.getApplications();
  const updated = applications.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a));
  await store.setApplications(updated);
  return updated.find((a) => a.id === id)!;
}

async function processApplicationPipeline(applicationId: string) {
  const applications = await store.getApplications();
  const application = applications.find((a) => a.id === applicationId);
  if (!application) return;

  const programs = await store.getPrograms();
  const program = programs.find((p) => p.id === application.programId);
  if (!program) {
    await updateApplication(applicationId, { stage: "discovered", statusNote: "Program not found." });
    return;
  }

  const extraction = await extractApplicationQuestions(program.applyUrl);
  if (!extraction) {
    await updateApplication(applicationId, {
      statusNote: "Couldn't read the application form. It may need a real TinyFish key, or the site blocked the agent.",
    });
    return;
  }
  if (extraction.requiresLogin) {
    await updateApplication(applicationId, {
      statusNote: "This program requires creating an account before showing the form — set one up manually, then re-run.",
    });
    return;
  }
  if (extraction.questions.length === 0) {
    await updateApplication(applicationId, { statusNote: "No application questions found on this page." });
    return;
  }

  await updateApplication(applicationId, {
    stage: "drafting",
    statusNote: `${extraction.questions.length} questions found — drafting answers...`,
  });

  const profile = await store.getCompanyProfile();
  const drafted = await draftAnswers(extraction.questions, profile);

  await updateApplication(applicationId, {
    stage: "ready",
    statusNote: "Answers drafted — ready for your review.",
    questions: drafted,
  });
}

// Explicit, separate action — the actual fill + submit run.
export async function submitApplication(applicationId: string) {
  const applications = await store.getApplications();
  const application = applications.find((a) => a.id === applicationId);
  if (!application) throw new Error("Application not found");

  const programs = await store.getPrograms();
  const program = programs.find((p) => p.id === application.programId);
  if (!program) throw new Error("Program not found");

  const result = await fillAndSubmitApplication(program.applyUrl, application.questions);
  if (!result) {
    await updateApplication(applicationId, { statusNote: "Submission failed — no TinyFish key configured, or the run errored." });
    return { submitted: false };
  }

  if (result.submitted) {
    await updateApplication(applicationId, {
      stage: "submitted",
      statusNote: result.note,
      submittedAt: new Date().toISOString(),
    });
  } else {
    await updateApplication(applicationId, { statusNote: result.note });
  }

  return { submitted: result.submitted, note: result.note };
}
