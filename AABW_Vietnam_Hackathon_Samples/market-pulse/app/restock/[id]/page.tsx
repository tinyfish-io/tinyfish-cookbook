"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Trash2, PartyPopper } from "lucide-react";
import type { RestockRequest } from "@/lib/types";
import { fetchJson } from "@/lib/fetchJson";

export default function RestockDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<RestockRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson(`/api/restock-requests/${params.id}`);
      setRequest(data.request);
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

  function updateAnswer(index: number, draft: string) {
    if (!request) return;
    const answers = request.answers.map((a, i) => (i === index ? { ...a, draft, edited: true } : a));
    setRequest({ ...request, answers });
  }

  async function handleSave() {
    if (!request) return;
    setSaving(true);
    await fetch(`/api/restock-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: request.answers }),
    });
    setSaving(false);
  }

  async function handleSubmit() {
    if (!request) return;
    setSubmitting(true);
    await fetch(`/api/restock-requests/${request.id}/submit`, { method: "POST" });
    await load();
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!request) return;
    setDeleting(true);
    await fetch(`/api/restock-requests/${request.id}`, { method: "DELETE" });
    router.push("/restock");
  }

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load this request</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }
  if (!loaded || !request) return <div className="skeleton h-96" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push("/restock")} className="text-xs text-text-secondary hover:text-accent transition-colors flex items-center gap-1.5">
          <ArrowLeft size={13} /> Back to stock report
        </button>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border text-text-muted hover:text-danger hover:border-danger/40 transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={12} /> Delete
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Delete this request?</span>
            <button onClick={handleDelete} disabled={deleting} className="px-2.5 py-1 rounded-md bg-danger text-white disabled:opacity-50">
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-md border border-border text-text-secondary">
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-2xl">{request.productName}</h1>
        <p className="text-sm text-text-muted mt-1">Supplier: {request.supplierName}</p>
        <p className="text-xs text-text-muted mt-2 card-surface rounded-lg px-3 py-2 inline-block">{request.reason}</p>
      </div>

      {request.answers.length > 0 && (
        <div className="space-y-4">
          {request.answers.map((a, i) => (
            <div key={a.fieldId} className="card-surface rounded-xl p-5">
              <p className="text-sm font-medium mb-2">{a.label}</p>
              <textarea
                className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow"
                rows={a.fieldId === "reason" || a.fieldId === "competitiveNote" ? 3 : 1}
                value={a.draft}
                onChange={(e) => updateAnswer(i, e.target.value)}
                disabled={request.stage === "submitted"}
              />
              {a.edited && <p className="text-[11px] text-text-muted mt-1">Edited by you</p>}
            </div>
          ))}

          {request.stage === "ready" && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save edits"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-burgundy text-accent text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Send size={13} /> {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          )}

          <AnimatePresence>
            {request.stage === "submitted" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="rounded-xl p-6 text-center"
                style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)" }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 15 }}
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-accent"
                >
                  <PartyPopper size={20} className="text-[#1a1108]" />
                </motion.div>
                <p className="text-base font-medium mb-1 text-accent">Restock request completed</p>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  Not yet connected to a real supplier system — this is the full drafted request, ready for that final step.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
