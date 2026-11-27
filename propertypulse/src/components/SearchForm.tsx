"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import type { PropertyType, ListingIntent } from "@/lib/types";

export default function SearchForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("apartment");
  const [intent, setIntent] = useState<ListingIntent>("rent");
  const [clientName, setClientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!area.trim()) {
      setError("Area is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, propertyType, intent, clientName: clientName || null }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that search");
      return;
    }
    setArea("");
    setClientName("");
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-4 py-2.5 rounded-lg bg-accent text-white font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
      >
        <Plus size={14} /> Track a new area
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card-surface rounded-xl p-5 mb-6">
      <p className="text-sm font-medium mb-3">Track a new area</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Area</label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. District 2, Thao Dien"
            className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Property type</label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value as PropertyType)}
            className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          >
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Rent or sale</label>
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value as ListingIntent)}
            className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          >
            <option value="rent">For rent</option>
            <option value="sale">For sale</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Client name (optional)</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="For your own reference only"
            className="w-full mt-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {submitting ? "Adding…" : "Start tracking"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text-primary transition-colors">
          Cancel
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
      <p className="text-[11px] text-text-muted mt-3">Sweeps immediately once, then every 48 hours at 11:30 AM Vietnam time.</p>
    </form>
  );
}
