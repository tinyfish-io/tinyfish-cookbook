import type { FormEvent, KeyboardEvent } from "react";
import { useState } from "react";

import { Cross } from "../components/icons.tsx";
import { SampleReport } from "../components/SampleReport.tsx";
import { SiteAvatar, usePageTitle } from "../components/ui.tsx";
import { startAudit } from "../lib/api.ts";
import { pickedSites, planNote } from "../lib/plan.ts";
import type { PlannedSite } from "../lib/sites.ts";
import { addSite, MAX_SITES, parseSite } from "../lib/sites.ts";
import { useAuditPlan } from "../lib/useAuditPlan.ts";
import { useExamples } from "../lib/useExamples.ts";
import { navigate } from "../lib/useRoute.ts";

function pinnedSite(url: string): PlannedSite | null {
  if (!url) return null;
  const parsed = parseSite(url);
  return parsed.ok ? { url: parsed.url, host: parsed.host } : null;
}

interface SiteChipProps {
  site: PlannedSite;
  onRemove: () => void;
}

function SiteChip({ site, onRemove }: SiteChipProps) {
  return (
    <li className="site-chip">
      <SiteAvatar host={site.host} small />
      <span className="min-w-0 truncate">{site.host}</span>
      <button
        type="button"
        className="round-button"
        aria-label={`Remove ${site.host}`}
        onClick={onRemove}
      >
        <Cross />
      </button>
    </li>
  );
}

interface HomeProps {
  prefill: { task: string; url: string };
}

export function Home({ prefill }: HomeProps) {
  usePageTitle("Aletheia");
  const [task, setTask] = useState(prefill.task);
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<PlannedSite[]>(() => {
    const pinned = pinnedSite(prefill.url);
    return pinned ? [pinned] : [];
  });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { plan, pending, failed } = useAuditPlan(task);
  const examples = useExamples();
  // A site carried over from a report is the whole audit, so the planner stays out of it.
  const pinned = pinnedSite(prefill.url) !== null;
  const picks = pinned ? [] : (plan?.sites ?? []);
  const sites = pickedSites(picks, { removed, added });
  const edited = pinned || removed.length > 0 || added.length > 0;

  function addDraft() {
    const parsed = parseSite(draft);
    const next = parsed.ok ? addSite(sites, parsed) : parsed;
    if (!next.ok) {
      setSiteError(next.message);
      return;
    }
    if (!parsed.ok) return;
    setSiteError(null);
    setDraft("");
    setAdding(false);
    setRemoved((current) => current.filter((host) => host !== parsed.host));
    setAdded((current) => [...current, parsed]);
  }

  function remove({ host }: PlannedSite) {
    setRemoved((current) => [...current, host]);
    setAdded((current) => current.filter((site) => site.host !== host));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setFormError(null);

    const wording = task.trim();
    const taskProblem = wording.length < 3 ? "Say what to audit." : null;
    setTaskError(taskProblem);
    if (taskProblem) return;

    // With nothing edited the server can plan for itself, even if our own plan is still on its way.
    const letServerPick = !edited && (pending || !plan);
    if (!letServerPick && sites.length === 0) {
      setSiteError("Add at least one site.");
      setAdding(true);
      return;
    }

    setBusy(true);
    try {
      const flow = pending ? null : plan?.flow;
      const audit = await startAudit({
        task: wording,
        ...(flow ? { flow } : {}),
        ...(letServerPick
          ? {}
          : {
              sites: sites.map(({ url }) => ({ url })),
            }),
      });
      navigate(`/audits/${audit.id}`);
    } catch (error) {
      setBusy(false);
      setFormError(error instanceof Error ? error.message : "The audit could not start.");
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submit();
  }

  const note = plan && !pinned && !edited ? planNote(plan) : null;
  const typed = task.trim().length >= 3;

  return (
    <div className="relative flex flex-col items-center pt-6 text-center sm:pt-14">
      <div aria-hidden="true" className="aurora" />

      <h1 className="max-w-[720px] text-[38px]/[1.06] tracking-[-0.035em] sm:text-[56px]/[1.04]">
        Find the dark patterns on <span className="accent">any</span> website.
      </h1>
      <p className="mt-4 max-w-[560px] text-base text-body sm:text-[17px]">
        Say what you want to buy or sign up for, and Aletheia reports every dark pattern it sees.
      </p>

      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="mt-7 flex w-full flex-col items-center gap-4 sm:mt-9"
      >
        <div className="rise prompt-card">
          <label htmlFor="task" className="text-sm font-medium text-mute">
            What should Aletheia audit?
          </label>
          <textarea
            id="task"
            rows={3}
            maxLength={300}
            value={task}
            onChange={(event) => setTask(event.target.value)}
            onKeyDown={submitOnEnter}
            placeholder="Say what you want to buy, book or sign up for"
            aria-invalid={taskError !== null}
            aria-describedby={taskError ? "task-error" : undefined}
            className="prompt-field mt-1.5"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {taskError ? (
              <p id="task-error" className="font-medium text-peach-ink">
                {taskError}
              </p>
            ) : (
              <p className="text-[13px] text-mute">Aletheia picks the sites from your words.</p>
            )}
            <button type="submit" className="btn btn-ring ml-auto px-[26px]" disabled={busy}>
              {busy ? "Starting the audit" : "Run audit"}
            </button>
          </div>
        </div>

        {task.length === 0 && examples.length > 0 ? (
          <ul aria-label="Examples" className="flex max-w-[720px] flex-wrap justify-center gap-2">
            {examples.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() => setTask(example)}
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex w-full max-w-[720px] flex-col items-center gap-2.5">
          {sites.length > 0 ? (
            <ul aria-label="Sites to audit" className="flex flex-wrap justify-center gap-2">
              {sites.map((site) => (
                <SiteChip key={site.host} site={site} onRemove={() => remove(site)} />
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-mute">
            {pending && typed ? (
              <span role="status" className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="spinner size-3" />
                Picking sites
              </span>
            ) : note ? (
              <span>{note}</span>
            ) : null}
            {failed && !pending ? (
              <span role="status">Could not pick sites yet. Run audit will try again.</span>
            ) : null}
            {plan?.question && !pinned && !pending ? (
              <span className="font-medium text-ink">{plan.question.text}</span>
            ) : null}
            {sites.length < MAX_SITES && !adding ? (
              <button
                type="button"
                className="link inline-flex min-h-11 items-center sm:min-h-6"
                onClick={() => setAdding(true)}
              >
                Add a site
              </button>
            ) : null}
          </div>

          {plan?.question && !pinned && !pending && sites.length === 0 ? (
            <ul aria-label="Suggested sites" className="flex flex-wrap justify-center gap-2">
              {plan.question.suggestions.map(({ url, host }) => (
                <li key={host}>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={() => {
                      setRemoved((current) => current.filter((entry) => entry !== host));
                      setAdded((current) => [...current, { url, host }]);
                    }}
                  >
                    {host}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {adding ? (
            <div className="flex w-full max-w-[420px] gap-2">
              <label htmlFor="site" className="sr-only">
                Site address
              </label>
              <input
                id="site"
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDraft();
                  }
                  if (event.key === "Escape") setAdding(false);
                }}
                placeholder="Any site address"
                aria-invalid={siteError !== null}
                aria-describedby={siteError ? "site-error" : undefined}
                className="field min-w-0 flex-1 py-1.5"
              />
              <button type="button" className="btn btn-soft btn-sm shrink-0" onClick={addDraft}>
                Add site
              </button>
            </div>
          ) : null}
          {siteError ? (
            <p id="site-error" className="font-medium text-peach-ink">
              {siteError}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p role="alert" className="font-medium text-peach-ink">
            {formError}
          </p>
        ) : null}
      </form>

      <SampleReport />
    </div>
  );
}
