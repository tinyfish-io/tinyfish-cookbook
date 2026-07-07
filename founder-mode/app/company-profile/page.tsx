"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import type { CompanyProfile, Founder } from "@/lib/types";
import { fetchJson } from "@/lib/fetchJson";

const EMPTY: CompanyProfile = {
  name: "",
  pitch: "",
  sector: "",
  stage: "",
  website: "",
  tractionSummary: "",
  founders: [],
};

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/company-profile");
      setProfile(data.profile);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function field<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function updateFounder(index: number, patch: Partial<Founder>) {
    setProfile((p) => ({
      ...p,
      founders: p.founders.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }

  function addFounder() {
    setProfile((p) => ({ ...p, founders: [...p.founders, { name: "", role: "", bio: "" }] }));
  }

  function removeFounder(index: number) {
    setProfile((p) => ({ ...p, founders: p.founders.filter((_, i) => i !== index) }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/company-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    setProfile(data.profile);
    setSaving(false);
    setSavedAt(new Date());
  }

  if (loadError) {
    return (
      <div className="card-surface rounded-xl p-6">
        <p className="text-sm font-medium text-danger mb-1">Couldn't load company profile</p>
        <p className="text-xs text-text-muted break-words">{loadError}</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  const inputClass =
    "w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-shadow";
  const labelClass = "text-xs text-text-secondary block mb-1";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Company profile</h1>
        <p className="text-sm text-text-muted mt-1">
          This is what your agents use to draft answers on every application — the better filled in this is, the better the drafts.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card-surface rounded-xl p-5">
          <p className="text-sm font-medium mb-4">Basics</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Company name</label>
              <input className={inputClass} value={profile.name} onChange={(e) => field("name", e.target.value)} placeholder="Kaira Labs" />
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input className={inputClass} value={profile.website} onChange={(e) => field("website", e.target.value)} placeholder="https://kaira.io" />
            </div>
            <div>
              <label className={labelClass}>Sector</label>
              <input className={inputClass} value={profile.sector} onChange={(e) => field("sector", e.target.value)} placeholder="Fintech, Logistics, AI..." />
            </div>
            <div>
              <label className={labelClass}>Stage</label>
              <select className={inputClass} value={profile.stage} onChange={(e) => field("stage", e.target.value)}>
                <option value="">Select stage</option>
                <option>Idea</option>
                <option>Pre-seed</option>
                <option>Seed</option>
                <option>Series A</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>One-line pitch</label>
              <input
                className={inputClass}
                value={profile.pitch}
                onChange={(e) => field("pitch", e.target.value)}
                placeholder="What does the company do, in one sentence?"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Traction summary</label>
              <textarea
                className={inputClass}
                rows={3}
                value={profile.tractionSummary}
                onChange={(e) => field("tractionSummary", e.target.value)}
                placeholder="Revenue, users, growth, pilots, notable customers — whatever's real and relevant."
              />
            </div>
          </div>
        </div>

        <div className="card-surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium">Founders</p>
            <button
              type="button"
              onClick={addFounder}
              className="text-xs px-2.5 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent-soft transition-colors flex items-center gap-1"
            >
              <Plus size={13} /> Add founder
            </button>
          </div>

          {profile.founders.length === 0 && <p className="text-sm text-text-muted">No founders added yet.</p>}

          <div className="space-y-4">
            {profile.founders.map((founder, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-text-muted">Founder {i + 1}</p>
                  <button type="button" onClick={() => removeFounder(i)} className="text-text-muted hover:text-danger transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelClass}>Name</label>
                    <input className={inputClass} value={founder.name} onChange={(e) => updateFounder(i, { name: e.target.value })} placeholder="Minh Anh" />
                  </div>
                  <div>
                    <label className={labelClass}>Role</label>
                    <input className={inputClass} value={founder.role} onChange={(e) => updateFounder(i, { role: e.target.value })} placeholder="CEO & Co-founder" />
                  </div>
                </div>
                <label className={labelClass}>Bio</label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={founder.bio}
                  onChange={(e) => updateFounder(i, { bio: e.target.value })}
                  placeholder="Background relevant to this company — prior startups, domain expertise, notable roles."
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {savedAt && !saving && (
            <span className="text-xs text-success flex items-center gap-1">
              <Check size={13} /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
