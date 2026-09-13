"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Send, Trash2, ArrowLeft, PartyPopper } from "lucide-react";
import type { Application, ApplicationStage } from "@/lib/types";
import { fetchJson } from "@/lib/fetchJson";

const STEPS: ApplicationStage[] = ["extracting", "drafting", "ready", "submitted"];
const STEP_LABEL: Record<ApplicationStage, string> = {
  discovered: "Discovered",
  extracting: "Extracted",
  drafting: "Drafted",
  ready: "Ready",
  submitted: "Submitted",
};

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitNote, setSubmitNote] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson(`/api/applications/${params.id}`);
      setApplication(data.application);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while still in-progress so the stepper advances live without a manual refresh.
  useEffect(() => {
    if (!application || application.stage === "ready" || application.stage === "submitted") return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [application, load]);

  function updateDraft(index: number, text: string) {
    if (!application) return;
    const questions = application.questions.map((q, i) => (i === index ? { ...q, draft: text, edited: true } : q));
    setApplication({ ...application, questions });
  }

  async function handleSaveEdits() {
    if (!application) return;
    setSaving(true);
    await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: application.questions }),
    });
    setSaving(false);
  }

  async function handleSubmit() {
    if (!application) return;
    setSubmitting(true);
    setSubmitNote(null);
    const res = await fetch(`/api/applications/${application.id}/submit`, { method: "POST" });
    const data = await res.json();
    setSubmitNote(data.note ?? (data.submitted ? "Submitted." : "Submission did not complete."));
    await load();
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!application) return;
    setDeleting(true);
    await fetch(`/api/applications/${application.id}`, { method: "DELETE" });
    router.push("/applications");
  }

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load this application</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }

  if (!loaded || !application) return <div className="skeleton h-96" />;

  const currentStepIndex = STEPS.indexOf(application.stage);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={13} /> Back to pipeline
        </button>
        <p className="text-xs text-text-muted font-mono">
          Application · {application.id.slice(0, 10)}
        </p>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium">{application.programName}</h1>
          <p className="text-sm text-text-muted mt-1">{application.statusNote}</p>
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border text-text-muted hover:text-danger hover:border-danger/40 transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={12} /> Delete
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Delete this application?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2.5 py-1 rounded-md bg-danger text-white disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-md border border-border text-text-secondary">
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="card-surface rounded-xl p-5 mb-6">
        <div className="flex items-center">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  animate={i === currentStepIndex && step !== "submitted" ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{
                    background: i <= currentStepIndex ? "var(--accent)" : "var(--surface-alt)",
                    color: i <= currentStepIndex ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {i < currentStepIndex ? <Check size={13} /> : i === currentStepIndex && step !== "submitted" ? <Loader2 size={13} className="animate-spin" /> : i + 1}
                </motion.div>
                <span className="text-[11px] text-text-secondary whitespace-nowrap">{STEP_LABEL[step]}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-2 relative overflow-hidden" style={{ background: "var(--border)" }}>
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: "var(--accent)" }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: i < currentStepIndex ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {application.questions.length > 0 && (
        <div className="space-y-4">
          {application.questions.map((q, i) => (
            <div key={q.id} className="card-surface rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{q.question}</p>
                {q.charLimit && (
                  <span className="text-[11px] text-text-muted tabular font-mono">
                    {q.draft.length}/{q.charLimit}
                  </span>
                )}
              </div>
              <textarea
                className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow"
                rows={3}
                value={q.draft}
                onChange={(e) => updateDraft(i, e.target.value)}
                disabled={application.stage === "submitted"}
              />
              {q.edited && <p className="text-[11px] text-text-muted mt-1">Edited by you</p>}
            </div>
          ))}

          {application.stage === "ready" && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveEdits}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent-soft transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save edits"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Send size={13} /> {submitting ? "Submitting…" : "Submit application"}
              </button>
              {submitNote && <span className="text-xs text-text-muted">{submitNote}</span>}
            </div>
          )}

          <AnimatePresence>
            {application.stage === "submitted" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="rounded-xl p-6 text-center"
                style={{ background: "var(--bg-success, rgba(27,156,110,0.08))", border: "1px solid var(--success)" }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 15 }}
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "var(--success)" }}
                >
                  <PartyPopper size={20} className="text-white" />
                </motion.div>
                <p className="text-base font-medium mb-1" style={{ color: "var(--success)" }}>
                  Application submitted
                </p>
                <p className="text-xs text-text-muted max-w-sm mx-auto">{application.statusNote}</p>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="mt-4 text-xs px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-danger hover:border-danger/40 transition-colors inline-flex items-center gap-1.5"
                >
                  <Trash2 size={12} /> Remove from pipeline
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
