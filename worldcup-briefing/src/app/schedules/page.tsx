"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

import Link from "next/link";
import { getCommonTimezones } from "@/lib/timezone";
import ConfirmModal from "@/components/ConfirmModal";
import ChannelIcon from "@/components/ChannelIcon";
import ModalShell from "@/components/ModalShell";
import LowCreditsBanner from "@/components/LowCreditsBanner";
import { ArrowLeftIcon, CalendarIcon, CheckIcon, CloseIcon } from "@/components/Icons";
import { DeliveryLoopIllustration } from "@/components/scheduler-illustrations";
import OnboardingStepper from "@/components/onboarding-stepper";
import { formatHourMinute, relativeTimeUntil } from "@/lib/time";

type ChannelItem = { id: string; name: string; type: string; isValidated: boolean };
type ScheduleItem = {
  id: string; query: string; runTime: string; timezone: string; channel: string;
  channelConfig: { channelIds?: string[] }; isActive: boolean;
  nextRunAt: string | null; lastRunAt: string | null; createdAt: string | null;
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
  const [deleteAffected, setDeleteAffected] = useState<string[]>([]);
  const [confirmToggle, setConfirmToggle] = useState<ScheduleItem | null>(null);

  // New channel form
  const [addPanel, setAddPanel] = useState(false);
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<"telegram" | "discord" | "slack">("telegram");
  const [addTgToken, setAddTgToken] = useState("");
  const [addTgChatId, setAddTgChatId] = useState("");
  const [addDcWebhook, setAddDcWebhook] = useState("");
  const [addSlackWebhook, setAddSlackWebhook] = useState("");
  const [addTesting, setAddTesting] = useState(false);
  const [addError, setAddError] = useState("");

  // New schedule form
  const [schedulePanel, setSchedulePanel] = useState(false);
  const [scheduleStep, setScheduleStep] = useState(1);
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleTimeConfirmed, setScheduleTimeConfirmed] = useState(false);
  const [scheduleTimezone, setScheduleTimezone] = useState("UTC");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleOk, setScheduleOk] = useState(false);
  const [scheduleEditingId, setScheduleEditingId] = useState<string | null>(null);

  const timezones = getCommonTimezones();
  const tzLabel = timezones.find((tz) => tz.value === scheduleTimezone)?.label || scheduleTimezone;
  const isBusy = scheduleSubmitting;

  async function fetchData(opts?: { openChannelIfEmpty?: boolean }) {
    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) { setError("Add API keys first"); setLoading(false); return; }
    setError("");
    const [sRes, cRes] = await Promise.all([
      fetch("/api/schedules", { headers: { "x-session-token": sessionToken } }),
      fetch("/api/channels", { headers: { "x-session-token": sessionToken } }),
    ]);
    const sData = await sRes.json();
    const cData = await cRes.json();
    const nextChannels = cData.channels || [];
    setSchedules(sData.schedules || []);
    setChannels(nextChannels);
    setLoading(false);
    if (opts?.openChannelIfEmpty && nextChannels.length === 0) {
      setAddPanel(true);
      setAddError("");
    }
  }

  useEffect(() => {
    function onSessionChange() {
      if (localStorage.getItem("session_token")) {
        setLoading(true);
        fetchData({ openChannelIfEmpty: true });
      } else {
        setError("Add API keys first");
        setChannels([]);
        setSchedules([]);
      }
    }
    window.addEventListener("session_changed", onSessionChange);
    return () => window.removeEventListener("session_changed", onSessionChange);
  }, []);

  useEffect(() => {
    fetchData();
    const editingRaw = localStorage.getItem("editing_schedule");
    if (editingRaw) {
      try {
        const editing = JSON.parse(editingRaw);
        localStorage.removeItem("editing_schedule");
        setScheduleEditingId(editing.id || null);
        setScheduleQuery(editing.query || "");
        setScheduleTime(editing.runTime || "09:00");
        setScheduleTimeConfirmed(false);
        setScheduleTimezone(editing.timezone || "UTC");
        const cfg = (editing.channelConfig || {}) as { channelIds?: string[] };
        setSelectedChannelIds(Array.isArray(cfg.channelIds) ? cfg.channelIds : []);
        setSchedulePanel(true);
        setScheduleStep(1);
        setScheduleOk(false);
        setScheduleError("");
      } catch {}
    }
  }, []);

  async function toggleSchedule(id: string, active: boolean) {
    const sessionToken = localStorage.getItem("session_token"); if (!sessionToken) return;
    const res = await fetch(`/api/schedules/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
      body: JSON.stringify({ isActive: !active }),
    });
    if (res.ok) setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !active } : s));
  }

  async function deleteSchedule(id: string) {
    const sessionToken = localStorage.getItem("session_token"); if (!sessionToken) return;
    const res = await fetch(`/api/schedules/${id}`, { method: "DELETE", headers: { "x-session-token": sessionToken } });
    if (res.ok) setSchedules((prev) => prev.filter((s) => s.id !== id));
    setDeleteScheduleId(null);
  }

  async function deleteChannel(id: string) {
    const sessionToken = localStorage.getItem("session_token"); if (!sessionToken) return;
    const res = await fetch(`/api/channels/${id}`, { method: "DELETE", headers: { "x-session-token": sessionToken } });
    if (res.ok) {
      setChannels((prev) => prev.filter((c) => c.id !== id));
    }
    setDeleteChannelId(null);
  }

  async function handleDeleteChannelClick(id: string) {
    const sessionToken = localStorage.getItem("session_token"); if (!sessionToken) return;
    const res = await fetch(`/api/channels/${id}`, { method: "DELETE", headers: { "x-session-token": sessionToken } });
    const data = await res.json();
    if (data.affectedScheduleIds?.length > 0) {
      setDeleteAffected(data.affectedScheduleIds);
      setDeleteChannelId(id);
    } else {
      setChannels((prev) => prev.filter((c) => c.id !== id));
    }
  }

  function closeAddPanel() {
    setAddPanel(false);
    setAddName("");
    setAddType("telegram");
    setAddTgToken("");
    setAddTgChatId("");
    setAddDcWebhook("");
    setAddSlackWebhook("");
    setAddError("");
  }

  async function handleAddChannel() {
    if (!addName.trim()) return;
    setAddTesting(true); setAddError("");
    const sessionToken = localStorage.getItem("session_token"); if (!sessionToken) return;
    const credentials: Record<string, string> = addType === "telegram"
      ? { botToken: addTgToken, chatId: addTgChatId, _name: addName }
      : addType === "discord"
        ? { webhookUrl: addDcWebhook, _name: addName }
        : { webhookUrl: addSlackWebhook, _name: addName };

    const validateBody: Record<string, unknown> = { [addType]: credentials };
    const vRes = await fetch("/api/validate-channels", { method: "POST", headers: { "Content-Type": "application/json", "x-session-token": sessionToken }, body: JSON.stringify(validateBody) });
    const vData = await vRes.json();
    const valid = vData[addType]?.valid;
    if (!valid) {
      setAddError(vData[addType]?.error || "Validation failed");
      setAddTesting(false); return;
    }

    const res = await fetch("/api/channels", {
      method: "POST", headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
      body: JSON.stringify({ name: addName, type: addType, credentials, isValidated: true }),
    });
    if (res.ok) {
      closeAddPanel();
      setAddTesting(false);
      fetchData();
    } else {
      const d = await res.json();
      setAddError(d.error || "Failed");
      setAddTesting(false);
    }
  }

  async function handleCreateSchedule() {
    setScheduleSubmitting(true); setScheduleError("");
    try {
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) { setScheduleError("Add API keys first."); return; }
      const isEdit = Boolean(scheduleEditingId);

      if (isEdit) {
        const res = await fetch(`/api/schedules/${scheduleEditingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
          body: JSON.stringify({ query: scheduleQuery, runTime: scheduleTime, timezone: scheduleTimezone, channelIds: selectedChannelIds }),
        });
        const data = await res.json();
        if (res.ok) { setScheduleOk(true); fetchData(); }
        else setScheduleError(data.error || "Could not update this schedule. Try again.");
      } else {
        const res = await fetch("/api/schedules", {
          method: "POST", headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
          body: JSON.stringify({ query: scheduleQuery, runTime: scheduleTime, timezone: scheduleTimezone, channelIds: selectedChannelIds }),
        });
        const data = await res.json();
        if (res.ok) { setScheduleOk(true); fetchData(); }
        else setScheduleError(data.error || "Could not create this schedule. Try again.");
      }
    } catch {
      setScheduleError("Could not save this schedule. Check your connection and try again.");
    } finally {
      setScheduleSubmitting(false);
    }
  }

  function openNewSchedule() {
    // Can't schedule without a delivery channel — guide the user to add one first.
    if (channels.length === 0) { setAddPanel(true); setAddError(""); return; }
    setScheduleEditingId(null);
    setSchedulePanel(true); setScheduleStep(1); setScheduleOk(false);
    setScheduleQuery(""); setScheduleTime("09:00"); setScheduleTimeConfirmed(false);
    setScheduleTimezone("UTC"); setSelectedChannelIds([]);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="size-5 animate-spin text-[#F24E1E]" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24">
        <header className="sticky top-0 z-20 -mx-4 flex h-14 items-center justify-between bg-[var(--c-bg)]/85 px-4 backdrop-blur-md">
          <Link href="/" className="ds-btn ds-btn--ghost-dark ds-btn--sm">
            <ArrowLeftIcon className="size-4" /> Back
          </Link>
        </header>

        {error ? (
          <div className="flex flex-col items-center justify-center py-16 max-w-[760px] mx-auto text-center">
            <div className="w-[180px] text-[var(--c-text)]">
              <DeliveryLoopIllustration className="h-auto w-full" />
            </div>
            <span className="ds-eyebrow ds-eyebrow--orange mt-2 block">The game-changer</span>
            <h1 className="mt-4 text-[26px] font-medium tracking-[-0.02em] text-[var(--c-text)]">
              An agent that delivers — while you do nothing
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--c-text-muted)] max-w-[440px]">
              Set a match query, a time and an inbox <span className="font-semibold text-[var(--c-text)]">once</span>. Every day the agent
              finds the match, cuts your reel and drops it straight into Telegram, Discord, or Slack. No app to open.
            </p>

            <OnboardingStepper
              hasSession={false}
              onScheduleCreated={() => fetchData()}
            />
          </div>
        ) : (
          <>
            {schedules.some((s) => s.isActive) ? <LowCreditsBanner /> : null}

            <section className="pt-10 pb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl tracking-tight text-[var(--c-text)]">Your Schedules</h1>
                  <p className="mt-1 text-[14px] text-[var(--c-text-subtle)]">Manage daily briefings and notification inboxes</p>
                </div>
                <button
                  type="button"
                  onClick={openNewSchedule}
                  className="ds-btn ds-btn--primary ds-btn--sm"
                  title={channels.length === 0 ? "Add an inbox first" : "Create a new schedule"}
                >
                  + New Schedule
                </button>
              </div>
            </section>

            {!loading && schedules.length === 0 ? (
              <OnboardingStepper
                hasSession={true}
                onScheduleCreated={() => fetchData()}
              />
            ) : null}

            {schedules.length > 0 && (
              <>
            {/* Channels Section */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[14px] font-medium text-[var(--c-text-muted)]">Inboxes ({channels.length})</h2>
                <button
                  type="button"
                  onClick={() => { setAddPanel(true); setAddError(""); }}
                  className="ds-btn ds-btn--ghost-dark ds-btn--sm"
                >
                  + Add Inbox
                </button>
              </div>
              {channels.length === 0 ? (
                <div className="ds-card ds-card--dark p-6 text-center">
                  <p className="text-[14px] text-[var(--c-text-subtle)]">No inboxes yet. Add one to start scheduling.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {channels.map((ch) => (
                    <div key={ch.id} className="ds-card ds-card--dark p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--c-hover-2)]">
                            <ChannelIcon type={ch.type} size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium text-[var(--c-text)] truncate">{ch.name}</p>
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--c-text-subtle)]">
                              {ch.type}{ch.isValidated ? "" : " · not tested"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Delete inbox"
                          onClick={() => handleDeleteChannelClick(ch.id)}
                          className="flex size-11 items-center justify-center rounded-full text-[var(--c-text-subtle)] transition-colors hover:bg-[#E5484D]/10 hover:text-[#E5484D]"
                        >
                          <CloseIcon className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Schedules List */}
            <section>
              <h2 className="text-[14px] font-medium text-[var(--c-text-muted)] mb-4">Schedules ({schedules.length})</h2>
              {schedules.length === 0 ? (
                <div className="ds-card ds-card--dark p-6 text-center">
                  <p className="text-[14px] text-[var(--c-text-subtle)]">No schedules yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map((s) => (
                    <div
                      key={s.id}
                      className="ds-card ds-card--dark p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <Link href={`/schedules/${s.id}`} className="text-[15px] font-medium text-[var(--c-text)] line-clamp-2 hover:text-[#F24E1E]">
                            {s.query}
                          </Link>
                          <p className="mt-1 text-[13px] text-[var(--c-text-subtle)]">
                            Daily at {formatHourMinute(s.runTime)} {s.timezone}
                          </p>
                          <p className="mt-0.5 text-[12px] text-[var(--c-text-subtle)]">
                            via {s.channel.split(",").map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)).join(" & ")}
                            {s.nextRunAt ? ` · ${relativeTimeUntil(s.nextRunAt)}` : ""}
                          </p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmToggle(s); }}
                            aria-pressed={s.isActive}
                            className={s.isActive ? "ds-pill-status ds-pill-status--orange" : "ds-pill-status ds-pill-status--muted-dark"}
                          >
                            {s.isActive ? "Active" : "Paused"}
                          </button>
                          <button
                            type="button"
                            aria-label="Delete schedule"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteScheduleId(s.id); }}
                            className="flex size-11 items-center justify-center rounded-full text-[var(--c-text-subtle)] transition-colors hover:bg-[#E5484D]/10 hover:text-[#E5484D]"
                          >
                            <CloseIcon className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
              </>
            )}
      </>
    )}

        {/* Add Channel Panel */}
        {addPanel ? (
          <ModalShell
            labelledBy="add-channel-title"
            onClose={closeAddPanel}
            closeOnBackdrop={!addTesting}
            className="animate-rise w-full max-w-md rounded-t-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-6 pt-6 pb-8 shadow-[0_-1px_48px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:pb-6 sm:shadow-[0_20px_48px_rgba(0,0,0,0.5)]"
          >
              <div className="mb-5 flex items-center justify-between">
                <h2 id="add-channel-title" className="text-[16px] font-semibold text-[var(--c-text)]">Add Inbox</h2>
                <button type="button" aria-label="Close" onClick={() => { if (!addTesting) closeAddPanel(); }} disabled={addTesting} className="rounded-full p-1 text-[var(--c-text-subtle)] transition-colors hover:bg-[var(--c-hover-2)] hover:text-[var(--c-text-muted)] disabled:opacity-50">
                  <CloseIcon className="size-4" />
                </button>
              </div>
              {addError ? (
                <div role="alert" className="mb-5 rounded-xl border border-[#E5484D]/40 bg-[#E5484D]/10 px-4 py-3 text-[13px] text-[#E5484D]">{addError}</div>
              ) : null}
              <div className="space-y-4">
                <div>
                  <label htmlFor="channel-name" className="ds-field-label ds-field-label--on-dark mb-1.5 block">Inbox name</label>
                   <input id="channel-name" type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={addType === "telegram" ? "Personal Telegram" : addType === "discord" ? "My Discord server" : "Team Slack channel"} disabled={addTesting} className="ds-input ds-input--dark w-full disabled:opacity-50" />
                </div>
                <div>
                  <label className="ds-field-label ds-field-label--on-dark mb-1.5 block">Type</label>
                   <div className="flex gap-1 rounded-full border border-[var(--c-border)] bg-[var(--c-hover)] p-1">
                     <button type="button" onClick={() => { setAddType("telegram"); setAddTgToken(""); setAddTgChatId(""); setAddError(""); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${addType === "telegram" ? "bg-[#F24E1E] !text-white" : "text-[var(--c-text-subtle)] hover:text-[var(--c-text)]"}`}><ChannelIcon type="telegram" size={15} mono={addType === "telegram"} className={addType === "telegram" ? "!text-white" : undefined} />Telegram</button>
                     <button type="button" onClick={() => { setAddType("discord"); setAddDcWebhook(""); setAddError(""); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${addType === "discord" ? "bg-[#F24E1E] !text-white" : "text-[var(--c-text-subtle)] hover:text-[var(--c-text)]"}`}><ChannelIcon type="discord" size={15} mono={addType === "discord"} className={addType === "discord" ? "!text-white" : undefined} />Discord</button>
                     <button type="button" onClick={() => { setAddType("slack"); setAddSlackWebhook(""); setAddError(""); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${addType === "slack" ? "bg-[#F24E1E] !text-white" : "text-[var(--c-text-subtle)] hover:text-[var(--c-text)]"}`}><ChannelIcon type="slack" size={15} mono={addType === "slack"} className={addType === "slack" ? "!text-white" : undefined} />Slack</button>
                   </div>
                </div>
                {addType === "telegram" ? (
                  <>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="ds-field-label ds-field-label--on-dark">Credentials</label>
                      <a
                        href="https://core.telegram.org/bots/tutorial"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] font-semibold text-[#F24E1E] no-underline hover:underline"
                      >
                        Get credentials →
                      </a>
                    </div>
                    <div>
                      <label htmlFor="tg-token" className="ds-field-label ds-field-label--on-dark mb-1.5 block">Bot Token</label>
                      <input id="tg-token" type="password" value={addTgToken} onChange={(e) => setAddTgToken(e.target.value)} placeholder="0000000000:XXXXX..." disabled={addTesting} className="ds-input ds-input--dark w-full disabled:opacity-50" />
                    </div>
                    <div>
                      <label htmlFor="tg-chat-id" className="ds-field-label ds-field-label--on-dark mb-1.5 block">Chat ID</label>
                      <input id="tg-chat-id" type="text" value={addTgChatId} onChange={(e) => setAddTgChatId(e.target.value)} placeholder="123456789" disabled={addTesting} className="ds-input ds-input--dark w-full disabled:opacity-50" />
                    </div>
                  </>
                ) : addType === "discord" ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="ds-field-label ds-field-label--on-dark">Webhook URL</label>
                      <a
                        href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] font-semibold text-[#F24E1E] no-underline hover:underline"
                      >
                        Get webhook URL →
                      </a>
                    </div>
                    <input type="text" value={addDcWebhook} onChange={(e) => setAddDcWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." disabled={addTesting} className="ds-input ds-input--dark w-full disabled:opacity-50" />
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="ds-field-label ds-field-label--on-dark">Webhook URL</label>
                      <a
                        href="https://api.slack.com/messaging/webhooks"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] font-semibold text-[#F24E1E] no-underline hover:underline"
                      >
                        Get webhook URL →
                      </a>
                    </div>
                    <input type="text" value={addSlackWebhook} onChange={(e) => setAddSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." disabled={addTesting} className="ds-input ds-input--dark w-full disabled:opacity-50" />
                  </div>
                )}
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button type="button" onClick={() => { closeAddPanel(); }} disabled={addTesting} className="ds-btn ds-btn--ghost-dark ds-btn--sm disabled:opacity-50">Cancel</button>
                <button type="button" onClick={handleAddChannel} disabled={addTesting || !addName.trim() || (addType === "telegram" ? !addTgToken.trim() || !addTgChatId.trim() : addType === "discord" ? !addDcWebhook.trim() : !addSlackWebhook.trim())} className="ds-btn ds-btn--primary ds-btn--sm flex-1">
                  {addTesting ? "Testing..." : "Add & Test"}
                </button>
              </div>
          </ModalShell>
        ) : null}

        {/* New Schedule Panel */}
        {schedulePanel ? (
          scheduleOk ? (
            <ModalShell
              labelledBy="schedule-ok-title"
              onClose={() => { setSchedulePanel(false); setScheduleEditingId(null); }}
              className="animate-rise w-full max-w-md rounded-t-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-6 pt-6 pb-8 shadow-[0_-1px_48px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:pb-6 sm:shadow-[0_20px_48px_rgba(0,0,0,0.5)]"
            >
                <div className="rounded-[20px] border border-[#F24E1E]/25 bg-[linear-gradient(135deg,rgba(242,78,30,0.16),rgba(242,78,30,0.045)_46%,rgba(255,255,255,0.03))] px-5 py-6 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F24E1E]/15 text-[#F24E1E] ring-1 ring-[#F24E1E]/25">
                    <CheckIcon className="size-5" />
                  </div>
                  <h2 id="schedule-ok-title" className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                    {scheduleEditingId ? "Schedule updated." : "Delivery is live."}
                  </h2>
                  <p className="mx-auto mt-2 max-w-[340px] text-[14px] leading-relaxed text-[var(--c-text-muted)]">
                    {scheduleEditingId
                      ? "Your agent will follow the updated rule from the next run."
                      : "Your agent is now set to find the moments, cut the reel, and deliver it automatically."}
                  </p>
                  <div className="mt-5 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-hover)] px-4 py-3 text-left">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F24E1E]/10 text-[#F24E1E]">
                        <CalendarIcon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--c-text)]">Daily at {formatHourMinute(scheduleTime)}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--c-text-subtle)]">
                          {tzLabel} · {selectedChannelIds.length} inbox{selectedChannelIds.length === 1 ? "" : "es"} selected
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-5 font-hand text-[22px] leading-snug text-[#F24E1E]">
                    Set once. Let the reel show up.
                  </p>
                </div>
                <div className="mt-5">
                  <button type="button" onClick={() => { setSchedulePanel(false); setScheduleEditingId(null); }} className="ds-btn ds-btn--primary ds-btn--sm w-full">Back to schedules</button>
                </div>
            </ModalShell>
          ) : (
            <ModalShell
              labelledBy="schedule-panel-title"
              onClose={() => { setSchedulePanel(false); setScheduleEditingId(null); }}
              closeOnBackdrop={!isBusy}
              className="animate-rise w-full max-w-md rounded-t-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-6 pt-6 pb-8 shadow-[0_-1px_48px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:pb-6 sm:shadow-[0_20px_48px_rgba(0,0,0,0.5)]"
            >
                <div className="mb-5 flex items-center justify-between">
                  <h2 id="schedule-panel-title" className="text-[16px] font-semibold text-[var(--c-text)]">{scheduleEditingId ? "Edit Schedule" : "New Schedule"}</h2>
                  <button type="button" aria-label="Close" onClick={() => { setSchedulePanel(false); setScheduleEditingId(null); }} disabled={isBusy} className="rounded-full p-1 text-[var(--c-text-subtle)] transition-colors hover:bg-[var(--c-hover-2)] hover:text-[var(--c-text-muted)] disabled:opacity-50">
                    <CloseIcon className="size-4" />
                  </button>
                </div>
                <div className="mb-5 flex items-center gap-1 rounded-full border border-[var(--c-border)] bg-[var(--c-hover)] p-1">
                  {["Query & Time", "Inbox", "Confirm"].map((label, i) => (
                    <button key={label} disabled={isBusy} className={`flex-1 rounded-full px-2 py-1 text-[12px] font-medium transition-all duration-200 ${scheduleStep === i + 1 ? "bg-[#F24E1E] !text-white" : "text-[var(--c-text-subtle)]"}`}>{label}</button>
                  ))}
                </div>
                {scheduleError ? (
                  <div role="alert" className="animate-rise mb-5 rounded-xl border border-[#E5484D]/40 bg-[#E5484D]/10 px-4 py-3 text-[13px] text-[#E5484D]">{scheduleError}</div>
                ) : null}
                {scheduleStep === 1 ? (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="schedule-query" className="ds-field-label ds-field-label--on-dark mb-1.5 block">Search query</label>
                      <input id="schedule-query" type="text" value={scheduleQuery} onChange={(e) => setScheduleQuery(e.target.value)} placeholder="e.g. highlights of fouls from USA vs Paraguay" disabled={isBusy} className="ds-input ds-input--dark w-full disabled:opacity-50" />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="min-w-0">
                        <label className="ds-field-label ds-field-label--on-dark mb-1.5 block">Time</label>
                        {scheduleTimeConfirmed ? (
                          <div className="flex items-center gap-2">
                            <span className="rounded-xl border border-[var(--c-border)] bg-[var(--c-hover)] px-4 py-2.5 text-[14px] text-[var(--c-text)] flex-1">{formatHourMinute(scheduleTime)}</span>
                            <button type="button" onClick={() => setScheduleTimeConfirmed(false)} disabled={isBusy} className="text-[12px] text-[var(--c-text-subtle)] underline-offset-2 hover:text-[var(--c-text-muted)] hover:underline shrink-0">Edit</button>
                          </div>
                        ) : (
                          (() => {
                            const [h, m] = scheduleTime.split(":").map(Number);
                            const h12 = h % 12 || 12;
                            const ampm = h < 12 ? "AM" : "PM";
                            const setTime = (hour12: number, min: number, ap: string) => {
                              let h24 = hour12;
                              if (ap === "PM" && hour12 !== 12) h24 = hour12 + 12;
                              if (ap === "AM" && hour12 === 12) h24 = 0;
                              setScheduleTime(`${h24.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
                            };
                            return (
                              <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-[var(--c-border)] bg-[var(--c-hover)] p-1.5">
                                <select
                                  value={h12}
                                  onChange={(e) => setTime(Number(e.target.value), m, ampm)}
                                  disabled={isBusy}
                                  aria-label="Hour"
                                  className="h-9 w-[72px] rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-[14px] font-semibold text-[var(--c-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#F24E1E]/50 disabled:opacity-50"
                                >
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                                <span className="text-[14px] font-semibold text-[var(--c-text-subtle)]">:</span>
                                <select
                                  value={m}
                                  onChange={(e) => setTime(h12, Number(e.target.value), ampm)}
                                  disabled={isBusy}
                                  aria-label="Minute"
                                  className="h-9 w-[72px] rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-[14px] font-semibold text-[var(--c-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#F24E1E]/50 disabled:opacity-50"
                                >
                                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((v) => (
                                    <option key={v} value={v}>{v.toString().padStart(2, "0")}</option>
                                  ))}
                                </select>
                                <div className="flex min-w-[104px] rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setTime(h12, m, "AM")}
                                    disabled={isBusy}
                                    aria-pressed={ampm === "AM"}
                                    className={`rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ${ampm === "AM" ? "bg-[#F24E1E] !text-white" : "text-[var(--c-text-subtle)] hover:text-[var(--c-text)]"}`}
                                  >AM</button>
                                  <button
                                    type="button"
                                    onClick={() => setTime(h12, m, "PM")}
                                    disabled={isBusy}
                                    aria-pressed={ampm === "PM"}
                                    className={`rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ${ampm === "PM" ? "bg-[#F24E1E] !text-white" : "text-[var(--c-text-subtle)] hover:text-[var(--c-text)]"}`}
                                  >PM</button>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>
                      <div className="min-w-0">
                        <label className="ds-field-label ds-field-label--on-dark mb-1.5 block">Timezone</label>
                        <select value={scheduleTimezone} onChange={(e) => setScheduleTimezone(e.target.value)} disabled={isBusy} className="ds-select ds-select--dark min-h-[46px] w-full text-[14px] font-medium text-[var(--c-text)] disabled:opacity-50">
                          {timezones.map((tz) => (<option key={tz.value} value={tz.value}>{tz.label}</option>))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : scheduleStep === 2 ? (
                  <div className="space-y-4">
                    <label className="ds-field-label ds-field-label--on-dark mb-1.5 block">Pick inboxes</label>
                    {channels.length === 0 ? (
                      <p className="text-[13px] text-[var(--c-text-subtle)]">No inboxes. Add one above first.</p>
                    ) : (
                      <div className="space-y-2">
                        {channels.map((ch) => (
                          <label key={ch.id} className="flex items-center gap-2.5 cursor-pointer rounded-xl border border-[var(--c-border)] bg-[var(--c-hover)] px-4 py-3 transition-all duration-200 hover:border-[#F24E1E]">
                            <input type="checkbox" checked={selectedChannelIds.includes(ch.id)} onChange={() => {
                              if (selectedChannelIds.includes(ch.id)) {
                                setSelectedChannelIds(selectedChannelIds.filter((id) => id !== ch.id));
                              } else {
                                setSelectedChannelIds([...selectedChannelIds, ch.id]);
                              }
                            }} disabled={isBusy} className="size-4 rounded accent-[#F24E1E]" />
                            <ChannelIcon type={ch.type} size={17} />
                            <span className="flex-1 text-[14px] text-[var(--c-text)]">{ch.name}</span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--c-text-subtle)]">{ch.type}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-[13px] font-medium text-[var(--c-text)]">Review your schedule</h3>
                    <div className="ds-card ds-card--dark p-4 space-y-2">
                      <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-subtle)]">Query</span><p className="text-[14px] text-[var(--c-text)]">{scheduleQuery}</p></div>
                      <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-subtle)]">Schedule</span><p className="text-[14px] text-[var(--c-text)]">Daily at {formatHourMinute(scheduleTime)} ({tzLabel})</p></div>
                      <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-subtle)]">Inboxes</span><p className="text-[14px] text-[var(--c-text)]">{selectedChannelIds.length ? channels.filter(c => selectedChannelIds.includes(c.id)).map(c => c.name).join(", ") : "None"}</p></div>
                    </div>
                    <button type="button" onClick={handleCreateSchedule} disabled={isBusy || !scheduleQuery.trim() || !scheduleTimeConfirmed || selectedChannelIds.length === 0} className="ds-btn ds-btn--primary w-full">
                      {scheduleSubmitting ? "Saving..." : scheduleEditingId ? "Save changes" : "Schedule daily briefing"}
                    </button>
                  </div>
                )}
                <div className="mt-6 flex items-center gap-3">
                  {scheduleStep > 1 ? (
                    <button type="button" onClick={() => setScheduleStep((s) => s - 1)} disabled={isBusy} className="ds-btn ds-btn--ghost-dark ds-btn--sm disabled:opacity-50">Back</button>
                  ) : (
                    <button type="button" onClick={() => { setSchedulePanel(false); setScheduleEditingId(null); }} disabled={isBusy} className="ds-btn ds-btn--ghost-dark ds-btn--sm disabled:opacity-50">Cancel</button>
                  )}
                  {scheduleStep < 3 ? (
                    <button type="button" onClick={() => { if (scheduleStep === 1) setScheduleTimeConfirmed(true); setScheduleStep((s) => s + 1); }} disabled={scheduleStep === 1 ? !scheduleQuery.trim() || !scheduleTime : selectedChannelIds.length === 0} className="ds-btn ds-btn--primary ds-btn--sm flex-1">Next</button>
                  ) : null}
                </div>
            </ModalShell>
          )
        ) : null}

        {/* Delete Channel Confirmation */}
        {deleteChannelId ? (
          <ModalShell
            labelledBy="delete-channel-title"
            onClose={() => setDeleteChannelId(null)}
            className="animate-rise w-full max-w-sm rounded-t-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-6 pt-6 pb-8 shadow-[0_-1px_48px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:pb-6 sm:shadow-[0_20px_48px_rgba(0,0,0,0.5)]"
          >
              <h2 id="delete-channel-title" className="text-[16px] font-semibold text-[var(--c-text)]">Delete inbox?</h2>
              {deleteAffected.length > 0 ? (
                <p className="mt-2 text-[13px] text-[var(--c-text-subtle)]">This inbox is used by {deleteAffected.length} active schedule{deleteAffected.length > 1 ? "s" : ""}. Removing it will affect those schedules.</p>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--c-text-subtle)]">This inbox is not linked to any schedule.</p>
              )}
              <div className="mt-5 flex items-center gap-3">
                <button type="button" onClick={() => setDeleteChannelId(null)} className="ds-btn ds-btn--ghost-dark ds-btn--sm">Cancel</button>
                <button type="button" onClick={() => deleteChannel(deleteChannelId)} className="ds-btn ds-btn--danger ds-btn--sm flex-1">Delete</button>
              </div>
          </ModalShell>
        ) : null}

        {/* Delete Schedule Confirmation */}
        {deleteScheduleId ? (
          <ModalShell
            labelledBy="delete-schedule-title"
            onClose={() => setDeleteScheduleId(null)}
            className="animate-rise w-full max-w-sm rounded-t-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-6 pt-6 pb-8 shadow-[0_-1px_48px_rgba(0,0,0,0.5)] sm:rounded-2xl sm:pb-6 sm:shadow-[0_20px_48px_rgba(0,0,0,0.5)]"
          >
              <h2 id="delete-schedule-title" className="text-[16px] font-semibold text-[var(--c-text)]">Delete schedule?</h2>
              <p className="mt-2 text-[13px] text-[var(--c-text-subtle)]">This will permanently remove the schedule. Past runs are not affected.</p>
              <div className="mt-5 flex items-center gap-3">
                <button type="button" onClick={() => setDeleteScheduleId(null)} className="ds-btn ds-btn--ghost-dark ds-btn--sm">Cancel</button>
                <button type="button" onClick={() => deleteSchedule(deleteScheduleId)} className="ds-btn ds-btn--danger ds-btn--sm flex-1">Delete</button>
              </div>
          </ModalShell>
        ) : null}

        <ConfirmModal
          open={!!confirmToggle}
          title={confirmToggle?.isActive ? "Pause this schedule?" : "Resume this schedule?"}
          confirmLabel={confirmToggle?.isActive ? "Pause" : "Resume"}
          onConfirm={() => {
            if (confirmToggle) {
              toggleSchedule(confirmToggle.id, confirmToggle.isActive);
              setConfirmToggle(null);
            }
          }}
          onClose={() => setConfirmToggle(null)}
        >
          {confirmToggle ? (
            <>
              <p>This will {confirmToggle.isActive ? "pause" : "resume"} daily briefings for:</p>
              <p className="mt-2 rounded-lg bg-[var(--c-hover)] px-3 py-2 font-medium text-[var(--c-text)]">
                &ldquo;{confirmToggle.query}&rdquo;
              </p>
            </>
          ) : null}
        </ConfirmModal>
      </div>
    </main>
  );
}
