"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import ChannelIcon from "@/components/ChannelIcon";
import { ArrowRightIcon, CalendarIcon, CheckIcon } from "@/components/Icons";
import { PanelConnectKeys, PanelAddInbox, PanelSetSchedule, PanelDelivered } from "@/components/scheduler-illustrations";
import { getCommonTimezones } from "@/lib/timezone";

type ChannelItem = { id: string; name: string; type: string; isValidated: boolean };

type StepDef = {
  id: string;
  number: number;
  title: string;
  desc: string;
  Panel: () => React.JSX.Element;
};

const STEPS: StepDef[] = [
  { id: "keys", number: 1, title: "Connect your keys", desc: "Link TinyFish and VideoDB so your agent can find and cut reels.", Panel: PanelConnectKeys },
  { id: "inbox", number: 2, title: "Add an inbox", desc: "Connect Telegram, Discord, or Slack where reels land.", Panel: PanelAddInbox },
  { id: "schedule", number: 3, title: "Set the schedule", desc: "Pick a match query, time, and timezone — the agent handles the rest.", Panel: PanelSetSchedule },
  { id: "delivered", number: 4, title: "Delivered to you", desc: "A ready-to-watch reel lands in your inbox — no app, no refresh.", Panel: PanelDelivered },
];

function formatHourMinute(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function OnboardingStepper({
  hasSession,
  onScheduleCreated,
}: {
  hasSession: boolean;
  onScheduleCreated?: (data: { query: string; runTime: string; timezone: string }) => void;
}) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const initializedRef = useRef(false);

  /* ---- step 0: keys ---- */
  const [tfKey, setTfKey] = useState("");
  const [vdbKey, setVdbKey] = useState("");
  const [keysValidating, setKeysValidating] = useState(false);
  const [keysError, setKeysError] = useState("");

  /* ---- step 1: inbox ---- */
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<"telegram" | "discord" | "slack">("telegram");
  const [addTgToken, setAddTgToken] = useState("");
  const [addTgChatId, setAddTgChatId] = useState("");
  const [addDcWebhook, setAddDcWebhook] = useState("");
  const [addSlackWebhook, setAddSlackWebhook] = useState("");
  const [addTesting, setAddTesting] = useState(false);
  const [addError, setAddError] = useState("");
  const [savedChannel, setSavedChannel] = useState<ChannelItem | null>(null);

  /* ---- step 2: schedule ---- */
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleTimezone, setScheduleTimezone] = useState("UTC");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  const timezones = getCommonTimezones();
  const tzLabel = timezones.find((t) => t.value === scheduleTimezone)?.label || scheduleTimezone;

  const visibleSteps = hasSession ? STEPS.slice(1) : STEPS;

  /* Init: if user already has session, skip step 0 */
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (hasSession) {
      setCompleted((prev) => new Set([...prev, 0]));
    }
  }, [hasSession]);

  useEffect(() => {
    if (initializedRef.current && hasSession && !completed.has(0)) {
      setCompleted((prev) => new Set([...prev, 0]));
    }
  }, [hasSession, completed]);

  function stepState(idx: number): "locked" | "active" | "done" {
    if (completed.has(idx)) return "done";
    if (idx === 0) return hasSession ? "done" : "active";
    if (completed.has(idx - 1)) return "active";
    return "locked";
  }

  /* ── Step 0: Save keys ──────────────────────────────────────── */
  async function saveKeys() {
    if (!tfKey.trim() || !vdbKey.trim()) return;
    setKeysValidating(true);
    setKeysError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tfApiKey: tfKey, vdbApiKey: vdbKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setKeysError(data.error || "Invalid keys");
        setKeysValidating(false);
        return;
      }
      localStorage.setItem("session_token", data.token);
      window.dispatchEvent(new Event("session_changed"));
      setTfKey("");
      setVdbKey("");
      setKeysValidating(false);
      setCompleted((prev) => new Set([...prev, 0]));
    } catch {
      setKeysError("Could not validate keys. Check your connection.");
      setKeysValidating(false);
    }
  }

  /* ── Step 1: Add inbox ──────────────────────────────────────── */
  async function handleAddChannel() {
    if (!addName.trim()) return;
    setAddTesting(true);
    setAddError("");
    try {
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) {
        setAddError("Connect your API keys first.");
        return;
      }

      const credentials: Record<string, string> =
        addType === "telegram"
          ? { botToken: addTgToken, chatId: addTgChatId, _name: addName }
          : addType === "discord"
            ? { webhookUrl: addDcWebhook, _name: addName }
            : { webhookUrl: addSlackWebhook, _name: addName };

      const validateBody: Record<string, unknown> = { [addType]: credentials };
      const vRes = await fetch("/api/validate-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
        body: JSON.stringify(validateBody),
      });
      const vData = await vRes.json();
      const valid = vData[addType]?.valid;
      if (!valid) {
        setAddError(vData[addType]?.error || "Could not validate this inbox. Check the credentials and try again.");
        return;
      }

      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
        body: JSON.stringify({ name: addName, type: addType, credentials, isValidated: true }),
      });
      const d = await res.json();
      if (res.ok) {
        setSavedChannel({ id: d.channelId, name: addName, type: addType, isValidated: true });
        setAddTgToken("");
        setAddTgChatId("");
        setAddDcWebhook("");
        setAddSlackWebhook("");
        setCompleted((prev) => new Set([...prev, 1]));
      } else {
        setAddError(d.error || "Could not save this inbox. Try again.");
      }
    } catch {
      setAddError("Could not test this inbox. Check your connection and try again.");
    } finally {
      setAddTesting(false);
    }
  }

  /* ── Step 2: Create schedule ────────────────────────────────── */
  async function handleCreateSchedule() {
    setScheduleSubmitting(true);
    setScheduleError("");
    try {
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) {
        setScheduleError("Connect your API keys first.");
        return;
      }
      if (!savedChannel) {
        setScheduleError("Add an inbox before scheduling delivery.");
        return;
      }

      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": sessionToken },
        body: JSON.stringify({
          query: scheduleQuery,
          runTime: scheduleTime,
          timezone: scheduleTimezone,
          channelIds: [savedChannel.id],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompleted((prev) => new Set([...prev, 2, 3]));
        onScheduleCreated?.({ query: scheduleQuery, runTime: scheduleTime, timezone: scheduleTimezone });
      } else {
        setScheduleError(data.error || "Could not create this schedule. Try again.");
      }
    } catch {
      setScheduleError("Could not create this schedule. Check your connection and try again.");
    } finally {
      setScheduleSubmitting(false);
    }
  }

  function resetInboxStep() {
    setSavedChannel(null);
    setAddError("");
    setCompleted((prev) => {
      const next = new Set(prev);
      next.delete(1);
      next.delete(2);
      next.delete(3);
      return next;
    });
  }

  return (
    <section className="ds-section--light text-[#111111]">
      <div className="mx-auto w-full max-w-[1080px] px-[22px] py-14 sm:py-16">
        <div className="ds-section-heading ds-section-heading--light ds-section-heading--centered">
          <span className="ds-eyebrow ds-eyebrow--orange">Build your daily reel loop</span>
          <h2 className="ds-section-heading__title">
            Your agent doesn&apos;t wait for you.<br />It delivers.
          </h2>
          <p className="ds-section-heading__lead">
            Set it up <span className="font-semibold text-[#111111]">once</span> — then a reel of exactly
            the moments you asked for arrives in your chat, every single day.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-[960px] space-y-4">
          {visibleSteps.map((step, vidx) => {
            const actualIdx = hasSession ? vidx + 1 : vidx;
            const state = stepState(actualIdx);
            const isLocked = state === "locked";
            const isDone = state === "done";
            const isActive = state === "active";
            const isStep4 = step.id === "delivered";
            const displayNumber = vidx + 1;
            const statusText = isStep4 && !isDone ? "Delivery loop" : isDone ? "Completed" : isActive ? "Ready for you" : actualIdx === 1 ? "Delivery inbox" : "Daily rule";
            const statusPill = isStep4 && !isDone ? "Runs daily" : isDone ? "Done" : isActive ? "Start here" : actualIdx === 1 ? "Chat destination" : "Query and time";

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
              <div
                key={step.id}
                className={`grid gap-4 rounded-[24px] border p-4 transition-all duration-300 md:grid-cols-[230px_minmax(0,1fr)] md:p-5 ${
                  isDone
                    ? isStep4 ? "border-[#F24E1E]/30 bg-[#F24E1E]/[0.025]" : "border-[#059669]/30 bg-[#059669]/[0.035]"
                    : isLocked
                      ? "border-[#F24E1E]/15 bg-[linear-gradient(135deg,#fffaf4,#ffffff)]"
                      : "border-[rgba(0,0,0,0.1)] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.06)]"
                } ${isActive ? "ring-1 ring-[#F24E1E]/25" : ""}`}
              >
                <div className="flex gap-4 md:block">
                  <div className="w-[104px] shrink-0 text-[#1a1a1a] md:mx-auto md:w-full md:max-w-[168px]">
                    <step.Panel />
                  </div>
                  <div className="min-w-0 md:mt-3 md:text-center">
                    <div className="flex items-center gap-2 md:justify-center">
                      <span
                        className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                          isDone
                            ? isStep4 ? "bg-[#F24E1E] text-white" : "bg-[#059669] text-white"
                            : isActive
                              ? "bg-[#F24E1E] text-white"
                              : "border border-[#F24E1E]/25 bg-[#F24E1E]/8 text-[#F24E1E]"
                        }`}
                      >
                        {isDone ? <CheckIcon className="size-3.5" /> : displayNumber}
                      </span>
                      <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#111111]">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-[rgba(0,0,0,0.58)]">
                      {step.desc}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-white/80 p-4 md:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[rgba(0,0,0,0.45)]">
                        {statusText}
                      </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isDone
                          ? isStep4 ? "bg-[#F24E1E]/10 text-[#F24E1E]" : "bg-[#059669]/10 text-[#047857]"
                          : isActive
                            ? "bg-[#F24E1E]/10 text-[#F24E1E]"
                            : "bg-[#F24E1E]/8 text-[#F24E1E]"
                      }`}
                    >
                      {statusPill}
                    </span>
                  </div>

                  {isLocked && !isStep4 ? (
                    <div className="rounded-[18px] border border-[#F24E1E]/14 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.035)]">
                      {actualIdx === 1 ? (
                        <div>
                          <div className="flex items-start gap-3">
                            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F24E1E]/10 text-[#F24E1E] ring-1 ring-[#F24E1E]/15">
                              <ChannelIcon type="telegram" size={18} mono />
                            </span>
                            <div>
                              <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#111111]">The destination</p>
                              <p className="mt-1.5 text-[13px] leading-relaxed text-[rgba(0,0,0,0.58)]">
                                Choose where every reel should arrive. Telegram works for a personal chat; Discord and Slack work well for team rooms.
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-3 py-3">
                              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111111]"><ChannelIcon type="telegram" size={15} /> Telegram</div>
                              <p className="mt-1 text-[11px] leading-relaxed text-[rgba(0,0,0,0.48)]">Bot token + chat ID</p>
                            </div>
                            <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-3 py-3">
                              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111111]"><ChannelIcon type="discord" size={15} /> Discord</div>
                              <p className="mt-1 text-[11px] leading-relaxed text-[rgba(0,0,0,0.48)]">Webhook URL</p>
                            </div>
                            <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-3 py-3">
                              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111111]"><ChannelIcon type="slack" size={15} /> Slack</div>
                              <p className="mt-1 text-[11px] leading-relaxed text-[rgba(0,0,0,0.48)]">Incoming webhook</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-start gap-3">
                            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F24E1E]/10 text-[#F24E1E] ring-1 ring-[#F24E1E]/15">
                              <CalendarIcon className="size-[18px]" />
                            </span>
                            <div>
                              <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#111111]">The routine</p>
                              <p className="mt-1.5 text-[13px] leading-relaxed text-[rgba(0,0,0,0.58)]">
                                Tell the agent what to hunt for and when the finished reel should drop. The rest becomes automatic.
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(0,0,0,0.42)]">Example rule</p>
                            <p className="mt-1 text-[13px] font-semibold text-[#111111]">Every goal from Brazil vs Argentina</p>
                            <p className="mt-1 text-[12px] text-[rgba(0,0,0,0.5)]">Daily at 9:00 AM → your saved inbox</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {actualIdx === 0 && !isLocked ? (
                    isDone ? (
                      <div className="flex items-start gap-3 rounded-[14px] border border-[#059669]/20 bg-[#059669]/[0.04] px-4 py-4">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#059669]/10 text-[#059669]">
                          <CheckIcon className="size-4" />
                        </span>
                        <div>
                          <p className="text-[14px] font-semibold text-[#111111]">API keys are connected.</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-[rgba(0,0,0,0.58)]">
                            TinyFish can discover moments and VideoDB can index, cut, and render the reels.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {keysError ? (
                          <div role="alert" className="rounded-[10px] border border-[#E5484D]/40 bg-[#E5484D]/10 px-3 py-2 text-[12px] text-[#E5484D]">
                            {keysError}
                          </div>
                        ) : null}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <label htmlFor="stepper-tf-key" className="text-[12px] font-medium text-[rgba(0,0,0,0.64)]">TinyFish API key</label>
                              <a href="https://agent.tinyfish.ai/api-keys" target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#F24E1E] no-underline hover:underline">
                                Get key →
                              </a>
                            </div>
                            <input id="stepper-tf-key" type="password" value={tfKey} onChange={(e) => setTfKey(e.target.value)}
                              placeholder="sk-..." autoComplete="off" disabled={keysValidating}
                              className="ds-input w-full disabled:cursor-not-allowed disabled:opacity-40" />
                          </div>
                          <div>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <label htmlFor="stepper-vdb-key" className="text-[12px] font-medium text-[rgba(0,0,0,0.64)]">VideoDB API key</label>
                              <a href="https://console.videodb.io" target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#F24E1E] no-underline hover:underline">
                                Get key →
                              </a>
                            </div>
                            <input id="stepper-vdb-key" type="password" value={vdbKey} onChange={(e) => setVdbKey(e.target.value)}
                              placeholder="sk-..." autoComplete="off" disabled={keysValidating}
                              className="ds-input w-full disabled:cursor-not-allowed disabled:opacity-40" />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-[rgba(0,0,0,0.07)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[12px] leading-relaxed text-[rgba(0,0,0,0.5)]">We validate both keys before unlocking inbox delivery.</p>
                          <button type="button" onClick={saveKeys}
                            disabled={keysValidating || !tfKey.trim() || !vdbKey.trim()}
                            className="ds-btn ds-btn--primary ds-btn--sm justify-center disabled:cursor-not-allowed disabled:opacity-50">
                            {keysValidating ? "Checking keys..." : "Save keys & continue"}
                            {!keysValidating && <ArrowRightIcon className="size-3.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  ) : null}

                  {actualIdx === 1 && !isLocked ? (
                    isDone && savedChannel ? (
                        <div className="flex items-start gap-3 rounded-[14px] border border-[#059669]/20 bg-[#059669]/[0.04] px-4 py-4">
                          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#059669]/10 text-[#059669]">
                            <CheckIcon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[#111111]">Inbox is connected.</p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[rgba(0,0,0,0.58)]">
                              <ChannelIcon type={savedChannel.type} size={15} />
                              <span className="font-medium text-[#111111]">{savedChannel.name}</span>
                              <span>will receive every reel.</span>
                            </p>
                            <button type="button" onClick={resetInboxStep} className="mt-3 text-[12px] font-semibold text-[#F24E1E] underline-offset-2 hover:underline">
                              Change inbox
                            </button>
                          </div>
                        </div>
                    ) : (
                      <div className="space-y-4">
                        {addError ? (
                          <div role="alert" className="rounded-[10px] border border-[#E5484D]/40 bg-[#E5484D]/10 px-3 py-2 text-[12px] text-[#E5484D]">
                            {addError}
                          </div>
                        ) : null}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label htmlFor="stepper-channel-name" className="mb-1.5 block text-[12px] font-medium text-[rgba(0,0,0,0.64)]">Inbox name</label>
                            <input id="stepper-channel-name" type="text" value={addName}
                              onChange={(e) => setAddName(e.target.value)}
                              placeholder={addType === "telegram" ? "Personal Telegram" : addType === "discord" ? "My Discord server" : "Team Slack channel"}
                              disabled={addTesting}
                              className="ds-input w-full disabled:cursor-not-allowed disabled:opacity-40" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[12px] font-medium text-[rgba(0,0,0,0.64)]">Delivery app</label>
                            <div className="flex min-h-[44px] gap-1 rounded-full border border-[rgba(0,0,0,0.1)] bg-[#f5f5f5] p-1">
                              <button type="button" aria-pressed={addType === "telegram"} onClick={() => { setAddType("telegram"); setAddTgToken(""); setAddTgChatId(""); setAddError(""); }}
                                disabled={addTesting}
                                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                  addType === "telegram" ? "bg-[#F24E1E] !text-white" : "text-[#666] hover:text-[#333]"
                                }`}>
                                <ChannelIcon type="telegram" size={14} mono={addType === "telegram"} className={addType === "telegram" ? "!text-white" : undefined} /> Telegram
                              </button>
                              <button type="button" aria-pressed={addType === "discord"} onClick={() => { setAddType("discord"); setAddDcWebhook(""); setAddError(""); }}
                                disabled={addTesting}
                                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                  addType === "discord" ? "bg-[#F24E1E] !text-white" : "text-[#666] hover:text-[#333]"
                                }`}>
                                <ChannelIcon type="discord" size={14} mono={addType === "discord"} className={addType === "discord" ? "!text-white" : undefined} /> Discord
                              </button>
                              <button type="button" aria-pressed={addType === "slack"} onClick={() => { setAddType("slack"); setAddSlackWebhook(""); setAddError(""); }}
                                disabled={addTesting}
                                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                  addType === "slack" ? "bg-[#F24E1E] !text-white" : "text-[#666] hover:text-[#333]"
                                }`}>
                                <ChannelIcon type="slack" size={14} mono={addType === "slack"} className={addType === "slack" ? "!text-white" : undefined} /> Slack
                              </button>
                            </div>
                          </div>
                        </div>
                        {addType === "telegram" ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <div className="mb-1.5 flex items-center justify-between gap-3">
                                <label htmlFor="stepper-tg-token" className="text-[12px] font-medium text-[rgba(0,0,0,0.64)]">Bot token</label>
                                <a href="https://core.telegram.org/bots/tutorial" target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#F24E1E] no-underline hover:underline">
                                  Help →
                                </a>
                              </div>
                              <input id="stepper-tg-token" type="password" value={addTgToken}
                                onChange={(e) => setAddTgToken(e.target.value)}
                                placeholder="0000000000:XXXXX..." disabled={addTesting}
                                className="ds-input w-full disabled:cursor-not-allowed disabled:opacity-40" />
                            </div>
                            <div>
                              <label htmlFor="stepper-tg-chat-id" className="mb-1.5 block text-[12px] font-medium text-[rgba(0,0,0,0.64)]">Chat ID</label>
                              <input id="stepper-tg-chat-id" type="text" value={addTgChatId}
                                onChange={(e) => setAddTgChatId(e.target.value)}
                                placeholder="123456789" disabled={addTesting}
                                className="ds-input w-full disabled:cursor-not-allowed disabled:opacity-40" />
                            </div>
                          </div>
                        ) : addType === "discord" ? (
                          <div>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <label htmlFor="stepper-discord-webhook" className="text-[12px] font-medium text-[rgba(0,0,0,0.64)]">Webhook URL</label>
                              <a href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#F24E1E] no-underline hover:underline">
                                Help →
                              </a>
                            </div>
                            <input id="stepper-discord-webhook" type="text" value={addDcWebhook} onChange={(e) => setAddDcWebhook(e.target.value)}
                              placeholder="https://discord.com/api/webhooks/..." disabled={addTesting}
                              className="ds-input w-full disabled:cursor-not-allowed disabled:opacity-40" />
                          </div>
                        ) : (
                          <div>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <label htmlFor="stepper-slack-webhook" className="text-[12px] font-medium text-[rgba(0,0,0,0.64)]">Webhook URL</label>
                              <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#F24E1E] no-underline hover:underline">
                                Get webhook URL →
                              </a>
                            </div>
                            <input id="stepper-slack-webhook" type="text" value={addSlackWebhook} onChange={(e) => setAddSlackWebhook(e.target.value)}
                              placeholder="https://hooks.slack.com/services/..." disabled={addTesting}
                              className="ds-input w-full disabled:cursor-not-allowed disabled:opacity-40" />
                          </div>
                        )}
                        <div className="flex flex-col gap-2 border-t border-[rgba(0,0,0,0.07)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[12px] leading-relaxed text-[rgba(0,0,0,0.5)]">We send a test request, then save this inbox for the schedule.</p>
                          <button type="button" onClick={handleAddChannel}
                            disabled={addTesting || !addName.trim() || (addType === "telegram" ? !addTgToken.trim() || !addTgChatId.trim() : addType === "discord" ? !addDcWebhook.trim() : !addSlackWebhook.trim())}
                            className="ds-btn ds-btn--primary ds-btn--sm justify-center disabled:cursor-not-allowed disabled:opacity-50">
                            {addTesting ? "Testing inbox..." : <span className="flex items-center gap-1.5">Test & save inbox <ArrowRightIcon className="size-3.5" /></span>}
                          </button>
                        </div>
                      </div>
                    )
                  ) : null}

                  {actualIdx === 2 && !isLocked ? (
                    isDone ? (
                      <div className="flex items-start gap-3 rounded-[14px] border border-[#059669]/20 bg-[#059669]/[0.04] px-4 py-4">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#059669]/10 text-[#059669]">
                          <CheckIcon className="size-4" />
                        </span>
                        <div>
                          <p className="text-[14px] font-semibold text-[#111111]">Daily schedule is live.</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-[rgba(0,0,0,0.58)]">
                            Runs at <span className="font-semibold text-[#111111]">{formatHourMinute(scheduleTime)} ({tzLabel})</span> and delivers to {savedChannel?.name || "your inbox"}.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {scheduleError ? (
                          <div role="alert" className="rounded-[10px] border border-[#E5484D]/40 bg-[#E5484D]/10 px-3 py-2 text-[12px] text-[#E5484D]">
                            {scheduleError}
                          </div>
                        ) : null}
                        <div>
                          <label htmlFor="stepper-schedule-query" className="mb-1.5 block text-[12px] font-medium text-[rgba(0,0,0,0.64)]">What moments should the agent find?</label>
                          <input id="stepper-schedule-query" type="text" value={scheduleQuery}
                            onChange={(e) => setScheduleQuery(e.target.value)}
                            placeholder="e.g. every goal from Brazil vs Argentina"
                            disabled={scheduleSubmitting}
                            className="ds-input w-full disabled:cursor-not-allowed disabled:opacity-40" />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-[12px] font-medium text-[rgba(0,0,0,0.64)]">Daily send time</label>
                            <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-[rgba(0,0,0,0.1)] bg-[#f5f5f5] p-1.5">
                              <select value={h12} onChange={(e) => setTime(Number(e.target.value), m, ampm)}
                                disabled={scheduleSubmitting}
                                aria-label="Hour"
                                className="h-9 w-[72px] rounded-lg border border-[rgba(0,0,0,0.1)] bg-white px-3 text-[14px] font-semibold text-[#111111] outline-none focus-visible:ring-2 focus-visible:ring-[#F24E1E]/40 disabled:opacity-40">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                              <span className="text-[13px] font-semibold text-[#999]">:</span>
                              <select value={m} onChange={(e) => setTime(h12, Number(e.target.value), ampm)}
                                disabled={scheduleSubmitting}
                                aria-label="Minute"
                                className="h-9 w-[72px] rounded-lg border border-[rgba(0,0,0,0.1)] bg-white px-3 text-[14px] font-semibold text-[#111111] outline-none focus-visible:ring-2 focus-visible:ring-[#F24E1E]/40 disabled:opacity-40">
                                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((v) => (
                                  <option key={v} value={v}>{v.toString().padStart(2, "0")}</option>
                                ))}
                              </select>
                              <div className="flex min-w-[104px] rounded-full border border-[rgba(0,0,0,0.1)] bg-white p-0.5">
                                <button type="button" onClick={() => setTime(h12, m, "AM")}
                                  disabled={scheduleSubmitting}
                                  aria-pressed={ampm === "AM"}
                                  className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    ampm === "AM" ? "bg-[#F24E1E] !text-white" : "text-[#777] hover:text-[#333]"
                                  }`}>AM</button>
                                <button type="button" onClick={() => setTime(h12, m, "PM")}
                                  disabled={scheduleSubmitting}
                                  aria-pressed={ampm === "PM"}
                                  className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    ampm === "PM" ? "bg-[#F24E1E] !text-white" : "text-[#777] hover:text-[#333]"
                                  }`}>PM</button>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label htmlFor="stepper-timezone" className="mb-1.5 block text-[12px] font-medium text-[rgba(0,0,0,0.64)]">Timezone</label>
                            <select id="stepper-timezone" value={scheduleTimezone} onChange={(e) => setScheduleTimezone(e.target.value)}
                              disabled={scheduleSubmitting}
                              className="ds-select ds-select--light w-full text-[12px] disabled:opacity-40">
                              {timezones.map((tz) => (
                                <option key={tz.value} value={tz.value}>{tz.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-3 py-2.5">
                          {savedChannel ? (
                            <div className="flex items-center gap-2">
                              <ChannelIcon type={savedChannel.type} size={15} />
                              <span className="flex-1 text-[13px] font-medium text-[#333]">{savedChannel.name}</span>
                              <span className="rounded-full bg-[#F24E1E]/10 px-2 py-0.5 text-[10px] font-medium text-[#F24E1E]">Delivery inbox</span>
                            </div>
                          ) : (
                            <p className="text-[12px] text-[rgba(0,0,0,0.5)]">Add an inbox above before creating the schedule.</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 border-t border-[rgba(0,0,0,0.07)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[12px] leading-relaxed text-[rgba(0,0,0,0.5)]">This creates the daily job and starts delivery automatically.</p>
                          <button type="button" onClick={handleCreateSchedule}
                            disabled={scheduleSubmitting || !scheduleQuery.trim() || !savedChannel}
                            className="ds-btn ds-btn--primary ds-btn--sm justify-center disabled:cursor-not-allowed disabled:opacity-50">
                            {scheduleSubmitting ? "Creating schedule..." : <span className="flex items-center gap-1.5">Create schedule & start <ArrowRightIcon className="size-3.5" /></span>}
                          </button>
                        </div>
                      </div>
                    )
                  ) : null}

                  {isStep4 ? (
                    isDone ? (
                      <div className="rounded-[18px] border border-[#F24E1E]/25 bg-[linear-gradient(135deg,rgba(242,78,30,0.12),rgba(242,78,30,0.035)_48%,rgba(255,255,255,0.7))] px-5 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F24E1E]/12 ring-1 ring-[#F24E1E]/20">
                          <CheckIcon className="size-5 text-[#F24E1E]" />
                        </div>
                        <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.02em] text-[#111111]">
                          Delivery is live.
                        </h3>
                        <p className="mx-auto mt-1.5 max-w-[460px] text-[13px] leading-relaxed text-[rgba(0,0,0,0.58)]">
                          Your first reel arrives at <span className="font-semibold text-[#111111]">{formatHourMinute(scheduleTime)} ({tzLabel})</span>. Every day the agent finds the match, cuts your reel, and drops it into your inbox.
                        </p>
                        <p className="mx-auto mt-4 max-w-[420px] font-hand text-[22px] leading-snug text-[#F24E1E]">
                          You set the rule. The agent keeps showing up.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-[#F24E1E]/14 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.035)]">
                        <div className="flex items-start gap-3">
                          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F24E1E]/10 text-[#F24E1E] ring-1 ring-[#F24E1E]/15">
                            <CheckIcon className="size-[18px]" />
                          </span>
                          <div>
                            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#111111]">The delivery loop</p>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-[rgba(0,0,0,0.58)]">
                              Once the schedule is live, the agent keeps watching for the moments you asked for and sends the finished reel to your inbox.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-3 py-3">
                            <CalendarIcon className="size-4 text-[#F24E1E]" />
                            <p className="mt-2 text-[12px] font-semibold text-[#111111]">Runs daily</p>
                          </div>
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-3 py-3">
                            <CheckIcon className="size-4 text-[#F24E1E]" />
                            <p className="mt-2 text-[12px] font-semibold text-[#111111]">Cuts the reel</p>
                          </div>
                          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-[#fafafa] px-3 py-3">
                            <ChannelIcon type="telegram" size={16} mono className="text-[#F24E1E]" />
                            <p className="mt-2 text-[12px] font-semibold text-[#111111]">Pings your inbox</p>
                          </div>
                        </div>
                        <p className="mt-4 font-hand text-[21px] leading-snug text-[#F24E1E]">
                          Set it once. Open chat to the reel.
                        </p>
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
