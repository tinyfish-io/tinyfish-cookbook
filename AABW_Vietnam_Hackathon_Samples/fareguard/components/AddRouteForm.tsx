"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function AddRouteForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ from: "", fromCity: "", to: "", toCity: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't add that route");
      return;
    }
    setForm({ from: "", fromCity: "", to: "", toCity: "" });
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent-soft transition-colors flex items-center gap-1"
      >
        <Plus size={13} /> Add route
      </button>
    );
  }

  return (
    <div className="card-surface rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Add a route to monitor</p>
        <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary">
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input
          value={form.from}
          onChange={(e) => setForm({ ...form, from: e.target.value.toUpperCase() })}
          placeholder="From code (HAN)"
          maxLength={3}
          className="bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
        <input
          value={form.fromCity}
          onChange={(e) => setForm({ ...form, fromCity: e.target.value })}
          placeholder="From city"
          className="bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
        <input
          value={form.to}
          onChange={(e) => setForm({ ...form, to: e.target.value.toUpperCase() })}
          placeholder="To code (SGN)"
          maxLength={3}
          className="bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
        <input
          value={form.toCity}
          onChange={(e) => setForm({ ...form, toCity: e.target.value })}
          placeholder="To city"
          className="bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
        <div className="col-span-2 sm:col-span-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 rounded-md bg-accent text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {submitting ? "Adding…" : "Add route"}
          </button>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </form>
      <p className="text-xs text-text-muted mt-2">Picked up automatically by the next sweep — no need to trigger anything.</p>
    </div>
  );
}
