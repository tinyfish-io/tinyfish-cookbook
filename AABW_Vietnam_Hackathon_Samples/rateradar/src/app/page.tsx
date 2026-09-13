"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, CheckCircle2, ExternalLink, Bot } from "lucide-react";
import { BANKS, COMPETITOR_BANKS } from "@/lib/banks";
import { PRODUCTS } from "@/lib/products";
import { SweepState, ApplicantProfile, ApplicationDraft, RateListing } from "@/lib/types";
import { formatVND, formatPercent } from "@/lib/formatters";
import { Navbar, NavTab } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { BankLogo } from "@/components/BankLogo";
import { SourcesStrip, AgentLiveState } from "@/components/SourcesStrip";
import { BankDetailModal } from "@/components/BankDetailModal";

type FullState = SweepState & { applications: ApplicationDraft[] };

function mergeListings(existing: RateListing[], incoming: RateListing[]): RateListing[] {
  const map = new Map(existing.map((l) => [`${l.bankId}:${l.productId}`, l]));
  for (const l of incoming) map.set(`${l.bankId}:${l.productId}`, l);
  return Array.from(map.values());
}

export default function Home() {
  const [state, setState] = useState<FullState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [tab, setTab] = useState<NavTab>("compare");
  const [productId, setProductId] = useState(PRODUCTS[0].id);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState(25000000);
  const [amount, setAmount] = useState(300000000);
  const [tenure, setTenure] = useState(12);
  const [applying, setApplying] = useState(false);
  const [drafts, setDrafts] = useState<ApplicationDraft[]>([]);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<RateListing | null>(null);

  // "Your profile" tab — the same data that also drives the 2 auto-apply
  // agents that run on every sweep. Loads whatever's saved (or the
  // realistic default) on mount, editable, saves back to the same store.
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileIncome, setProfileIncome] = useState(0);
  const [profileProductId, setProfileProductId] = useState(PRODUCTS[0].id);
  const [profileAmount, setProfileAmount] = useState(0);
  const [profileTenure, setProfileTenure] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedNote, setProfileSavedNote] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/profile");
    const { profile } = await res.json();
    setProfileName(profile.name);
    setProfilePhone(profile.phone);
    setProfileIncome(profile.monthlyIncomeVND);
    setProfileProductId(profile.productId);
    setProfileAmount(profile.amountVND);
    setProfileTenure(profile.tenureMonths);
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function saveProfile() {
    setProfileSaving(true);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profileName,
        phone: profilePhone,
        monthlyIncomeVND: profileIncome,
        productId: profileProductId,
        amountVND: profileAmount,
        tenureMonths: profileTenure
      })
    });
    setProfileSaving(false);
    setProfileSavedNote("Saved — the next sweep's auto-applications will use this.");
    setTimeout(() => setProfileSavedNote(null), 4000);
  }
  const [agentStates, setAgentStates] = useState<Record<string, { name: string; state: AgentLiveState }>>(() =>
    Object.fromEntries(BANKS.map((b) => [b.id, { name: b.name, state: "pending" as AgentLiveState }]))
  );
  const sweepTriggeredRef = useRef(false);

  // Drives the same status dots as the SSE stream, but from plain polling —
  // this is what lets a passive page view (someone who never clicked "Sync
  // now" themselves, e.g. while GitHub Actions runs the daily sweep) still
  // see per-bank progress, instead of only the person who triggered it.
  const polledAgentStates = useMemo(() => {
    if (!state) return undefined;
    const map: Record<string, { name: string; state: AgentLiveState }> = {};
    for (const bank of BANKS) {
      const status = state.agentStatuses?.[bank.id];
      map[bank.id] = { name: bank.name, state: status ? "done" : state.sweepInProgress ? "running" : "pending" };
    }
    return map;
  }, [state]);

  async function runSweepNow() {
    if (sweeping) return; // never let two client-side triggers overlap either
    setSweeping(true);
    setRefreshNote(null);
    setAgentStates(Object.fromEntries(BANKS.map((b) => [b.id, { name: b.name, state: "pending" as AgentLiveState }])));

    const res = await fetch("/api/sweep/stream", { method: "POST" });
    if (!res.body) {
      setSweeping(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let outcome: "completed" | "skipped" | "dispatched" | "error" = "completed";
    let errorMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const eventLine = chunk.split("\n").find((l) => l.startsWith("event: "));
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!eventLine || !dataLine) continue;
        const event = eventLine.replace("event: ", "");
        const data = JSON.parse(dataLine.replace("data: ", ""));

        if (event === "bank_status") {
          setAgentStates((prev) => ({ ...prev, [data.bankId]: { name: data.bankName, state: "running" } }));
        } else if (event === "bank_done") {
          setAgentStates((prev) => ({ ...prev, [data.bankId]: { name: data.bankName, state: "done" } }));
          // Show this bank's result the instant it lands — don't wait for
          // the rest of the batch, since the agents genuinely run in parallel.
          setState((prev) =>
            prev
              ? { ...prev, listings: mergeListings(prev.listings, data.listings) }
              : { listings: data.listings, lastSweepAt: null, nextSweepAt: "", live: false, sweepInProgress: true, agentStatuses: {}, applications: [] }
          );
          setLoading(false);
        } else if (event === "complete") {
          setState((prev) => (prev ? { ...prev, ...data } : { ...data, applications: [] }));
        } else if (event === "dispatched") {
          // Running on Vercel — the real sweep now happens in GitHub
          // Actions instead of inline here, so this connection is done
          // the moment it's triggered. The already-built passive polling
          // (state.sweepInProgress / agentStatuses) picks up progress from
          // here, the same way it does for the scheduled daily run.
          outcome = "dispatched";
          const res2 = await fetch("/api/state");
          setState(await res2.json());
          setLoading(false);
        } else if (event === "error") {
          outcome = "error";
          errorMessage = data.message ?? "Something went wrong.";
        } else if (event === "skipped") {
          // Another trigger (e.g. the scheduled GitHub Actions run) already
          // holds the lock — this attempt correctly did nothing, but that's
          // not the same as "finished." Read what's actually there and let
          // the honest answer (sweepInProgress) decide what to say, instead
          // of unconditionally claiming "synced" below.
          outcome = "skipped";
          const res2 = await fetch("/api/state");
          const fresh: FullState = await res2.json();
          setState(fresh);
          setLoading(false);
        }
      }
    }

    if (outcome === "skipped") {
      setRefreshNote("Already syncing (started elsewhere) — watching for updates…");
      // Deliberately don't rely on the local sweeping flag alone — isSyncing
      // should keep reflecting reality via state.sweepInProgress until the
      // passive poll sees the real sweep finish.
      setSweeping(false);
      setTimeout(() => setRefreshNote(null), 6000);
    } else if (outcome === "dispatched") {
      setRefreshNote("Triggered — this can take a few minutes, updates will appear automatically.");
      setSweeping(false);
      setTimeout(() => setRefreshNote(null), 8000);
    } else if (outcome === "error") {
      setRefreshNote(`Couldn't sync: ${errorMessage}`);
      setSweeping(false);
      setTimeout(() => setRefreshNote(null), 8000);
    } else {
      setRefreshNote("Rates synced.");
      setSweeping(false);
      setTimeout(() => setRefreshNote(null), 4000);
    }
  }

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/state");
    const data: FullState = await res.json();
    // Always show whatever's already there — previous results, or
    // whatever's been gathered so far mid-sweep — never blank the screen
    // just because a sweep happens to be running right now.
    setState(data);
    setLoading(false);

    const genuinelyNothingYet = data.listings.length === 0 && !data.sweepInProgress;
    if (genuinelyNothingYet && !sweepTriggeredRef.current) {
      // Never swept before, and nobody else is currently sweeping either —
      // trigger the live stream ourselves. Guarded so React StrictMode's
      // double-invoke (or a fast refresh) can't fire it twice.
      sweepTriggeredRef.current = true;
      runSweepNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, state?.sweepInProgress ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [fetchState, state?.sweepInProgress]);

  // The 2 auto-apply agents save straight to the same application store —
  // this is what actually surfaces them here, instead of only ever seeing
  // applications you generated yourself by clicking the button below.
  useEffect(() => {
    const incoming = (state as FullState | null)?.applications;
    if (!incoming) return;
    setDrafts((prev) => {
      const map = new Map(prev.map((d) => [d.id, d]));
      for (const d of incoming) if (!map.has(d.id)) map.set(d.id, d);
      return Array.from(map.values());
    });
  }, [state]);

  const product = PRODUCTS.find((p) => p.id === productId)!;

  const listingsForProduct = useMemo(() => {
    const all = (state?.listings ?? []).filter((l) => l.productId === productId);
    return [...all].sort((a, b) => {
      const av = a.ratePercent ?? (product.kind === "savings" ? -Infinity : Infinity);
      const bv = b.ratePercent ?? (product.kind === "savings" ? -Infinity : Infinity);
      return product.kind === "savings" ? bv - av : av - bv;
    });
  }, [state, productId, product.kind]);

  const shinhanListing = listingsForProduct.find((l) => l.isSponsor);
  const bestListing = listingsForProduct[0];
  const shinhanIsBest = shinhanListing && bestListing && shinhanListing.bankId === bestListing.bankId;

  async function applyToAll() {
    if (!name.trim() || !phone.trim()) return;
    setApplying(true);
    setDrafts([]);
    const applicant: ApplicantProfile = {
      name,
      phone,
      monthlyIncomeVND: monthlyIncome,
      productId,
      amountVND: amount,
      tenureMonths: tenure
    };
    const res = await fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicant, listings: listingsForProduct })
    });
    const { drafts: newDrafts } = await res.json();
    setDrafts(newDrafts);
    setApplying(false);
  }

  async function markSubmitted(id: string) {
    await fetch("/api/apply/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status: "submitted_by_user" } : d)));
  }

  const isSyncing = sweeping || !!state?.sweepInProgress;

  return (
    <main className="min-h-screen">
      <Hero />
      <Navbar
        tab={tab}
        onTabChange={setTab}
        syncing={isSyncing}
        hasSyncedBefore={Boolean(state?.lastSweepAt)}
        nextSweepAt={state?.nextSweepAt ?? null}
        onSync={runSweepNow}
      />
      <AnimatePresence>
        {refreshNote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-w-6xl mx-auto px-6 pt-3 text-xs text-gold"
          >
            {refreshNote}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-8">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProductId(p.id)}
              className={`text-sm font-medium px-4 py-2 rounded-lg border transition ${
                productId === p.id ? "border-gold/50 bg-primary/20 text-gold" : "border-line text-muted hover:text-paper"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {loading && <div className="text-sm text-muted mb-10">Loading current rates…</div>}

        <AnimatePresence mode="wait">
          {!loading && tab === "compare" && (
            <motion.section
              key="compare"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-5 gap-8"
            >
              <div className="md:col-span-3">
                <h2 className="font-display text-lg font-semibold text-paper mb-3">
                  {product.kind === "savings" ? "Savings yield" : "Loan rate"} comparison
                </h2>
                <div className="space-y-2">
                  {listingsForProduct.map((l, i) => (
                    <motion.button
                      key={l.bankId}
                      onClick={() => setSelectedListing(l)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 card-surface text-left ${
                        l.isSponsor ? "border-gold/50 bg-primary/15" : i === 0 ? "border-mint/40 bg-mint/5" : "border-line bg-panel"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <BankLogo domain={l.domain} name={l.bankName} isSponsor={l.isSponsor} />
                        <span className={`text-sm ${l.isSponsor ? "text-gold font-semibold" : "text-paper/80"}`}>
                          {l.bankName}
                        </span>
                        {i === 0 && (
                          <span className="text-[9px] uppercase tracking-wide text-mint bg-mint/10 px-1.5 py-0.5 rounded">
                            best {product.kind === "savings" ? "yield" : "rate"}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-paper tabular-nums">
                        {l.ratePercent !== undefined ? formatPercent(l.ratePercent) : "—"}
                      </span>
                    </motion.button>
                  ))}
                </div>
                {shinhanListing && (
                  <div className="mt-3 text-xs text-muted flex items-center gap-1.5">
                    {shinhanIsBest ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5 text-mint" /> Shinhan currently has the best{" "}
                        {product.kind === "savings" ? "yield" : "rate"} for this product.
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3.5 w-3.5 text-amber" /> Shinhan is not currently the best offer —{" "}
                        {bestListing?.bankName} is ahead.
                      </>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setTab("apply")}
                  className="mt-6 text-sm font-medium bg-primary text-paper px-4 py-2.5 rounded-lg hover:bg-primary/80 transition border border-gold/30"
                >
                  Apply for this product →
                </button>
              </div>

              <div className="md:col-span-2">
                <h2 className="font-display text-lg font-semibold text-paper mb-3">Live sources</h2>
                <SourcesStrip listings={listingsForProduct} agentStates={sweeping ? agentStates : polledAgentStates} />
                <p className="text-[11px] text-muted mt-3">
                  Click any bank on the left for full details — rate, minimum amount, and when it was last checked.
                </p>
              </div>
            </motion.section>
          )}

          {!loading && tab === "apply" && (
            <motion.section
              key="apply"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-8"
            >
              <div>
                <h2 className="font-display text-lg font-semibold text-paper mb-3">Your details — {product.name}</h2>
                <div className="space-y-3 bg-panel border border-line rounded-lg p-4 card-surface">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wide text-muted">Full name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nguyen Van A"
                        className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wide text-muted">Phone</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09xx xxx xxx"
                        className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">Monthly income (VND)</label>
                    <input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                      className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">
                      {product.kind === "savings" ? "Deposit amount" : "Loan amount"} (VND)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">Tenure (months)</label>
                    <input
                      type="number"
                      value={tenure}
                      onChange={(e) => setTenure(Number(e.target.value))}
                      className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                    />
                  </div>
                  <button
                    onClick={applyToAll}
                    disabled={applying || !name.trim() || !phone.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-paper text-sm font-medium py-2.5 rounded-lg hover:bg-primary/80 disabled:opacity-50 transition border border-gold/30"
                  >
                    <Bot className="h-4 w-4 text-gold" />
                    {applying ? `Filling applications at ${BANKS.length} banks…` : `Auto-fill applications at all ${BANKS.length} banks`}
                  </button>
                  <p className="text-[11px] text-muted">
                    Agents run in two waves (5, then the remaining {BANKS.length - 5}) and each fills that bank's real
                    form, stopping before submit — you review and submit yourself.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="font-display text-lg font-semibold text-paper mb-3">Staged applications</h2>
                {drafts.filter((d) => d.productId === productId).length === 0 ? (
                  <div className="text-sm text-muted border border-dashed border-line rounded-lg p-6 text-center">
                    Fill in your details and auto-fill to see staged applications here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drafts
                      .filter((d) => d.productId === productId)
                      .sort((a, b) =>
                        product.kind === "savings"
                          ? (b.ratePercent ?? 0) - (a.ratePercent ?? 0)
                          : (a.ratePercent ?? 0) - (b.ratePercent ?? 0)
                      )
                      .map((d, i) => {
                        const bank = BANKS.find((b) => b.id === d.bankId);
                        return (
                          <motion.div
                            key={d.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="ghost-fill border border-line bg-panel rounded-lg p-4 card-surface"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="flex items-center gap-2 text-sm font-medium text-paper">
                                {bank && <BankLogo domain={bank.domain} name={d.bankName} />}
                                {d.bankName}
                              </span>
                              {d.status === "submitted_by_user" ? (
                                <span className="flex items-center gap-1 text-[10px] uppercase text-mint bg-mint/10 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="h-3 w-3" /> submitted
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase text-amber bg-amber/10 px-2 py-0.5 rounded-full">
                                  ready to submit
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 mb-3">
                              {d.fieldsStaged.map((f) => (
                                <div key={f.label} className="flex justify-between text-xs">
                                  <span className="text-muted">{f.label}</span>
                                  <span className="text-paper/80">{f.value}</span>
                                </div>
                              ))}
                            </div>
                            {d.estimatedMonthly !== undefined && (
                              <div className="text-xs text-gold font-medium mb-3">
                                Est. {product.kind === "loan" ? "monthly payment" : "monthly interest"}: {formatVND(d.estimatedMonthly)}
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <a
                                href={d.formUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-gold hover:underline flex items-center gap-1"
                              >
                                Open on {d.bankName} <ExternalLink className="h-3 w-3" />
                              </a>
                              {d.status !== "submitted_by_user" && (
                                <button
                                  onClick={() => markSubmitted(d.id)}
                                  className="text-xs text-muted hover:text-paper ml-auto"
                                >
                                  I submitted this
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {!loading && tab === "profile" && (
            <motion.section
              key="profile"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-lg"
            >
              <h2 className="font-display text-lg font-semibold text-paper mb-2">Your profile</h2>
              <p className="text-xs text-muted mb-4">
                This is what the 2 auto-apply agents use every sweep — Shinhan and {COMPETITOR_BANKS[0].name} both get
                a real application staged automatically using whatever's saved here. Starts filled with a realistic
                example; edit and save any time, the next sweep uses the update.
              </p>
              {!profileLoaded ? (
                <div className="text-sm text-muted">Loading…</div>
              ) : (
                <div className="space-y-3 bg-panel border border-line rounded-lg p-4 card-surface">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wide text-muted">Full name</label>
                      <input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wide text-muted">Phone</label>
                      <input
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">Monthly income (VND)</label>
                    <input
                      type="number"
                      value={profileIncome}
                      onChange={(e) => setProfileIncome(Number(e.target.value))}
                      className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">Product</label>
                    <select
                      value={profileProductId}
                      onChange={(e) => setProfileProductId(e.target.value)}
                      className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                    >
                      {PRODUCTS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">Amount (VND)</label>
                    <input
                      type="number"
                      value={profileAmount}
                      onChange={(e) => setProfileAmount(Number(e.target.value))}
                      className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-muted">Tenure (months)</label>
                    <input
                      type="number"
                      value={profileTenure}
                      onChange={(e) => setProfileTenure(Number(e.target.value))}
                      className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper focus:outline-none focus:border-gold"
                    />
                  </div>
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="w-full bg-primary text-paper text-sm font-medium py-2.5 rounded-lg hover:bg-primary/80 disabled:opacity-50 transition border border-gold/30"
                  >
                    {profileSaving ? "Saving…" : "Save profile"}
                  </button>
                  {profileSavedNote && <p className="text-xs text-mint text-center">{profileSavedNote}</p>}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
      <BankDetailModal listing={selectedListing} onClose={() => setSelectedListing(null)} />
    </main>
  );
}
