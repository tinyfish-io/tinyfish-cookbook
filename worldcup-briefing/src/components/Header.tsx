"use client";
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ConfirmModal from "@/components/ConfirmModal";
import KeyModal from "@/components/KeyModal";
import { ArrowRightIcon, CalendarIcon } from "@/components/Icons";

export default function Header() {
  const [tfKey, setTfKey] = useState("");
  const [vdbKey, setVdbKey] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [keyPanelOpen, setKeyPanelOpen] = useState(false);
  const [keysValidating, setKeysValidating] = useState(false);
  const [keysError, setKeysError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionToken(localStorage.getItem("session_token") || "");
  }, []);

  useEffect(() => {
    const handler = () => setKeyPanelOpen(true);
    window.addEventListener("open-key-modal", handler);
    return () => window.removeEventListener("open-key-modal", handler);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    if (accountOpen) {
      document.addEventListener("mousedown", handleClick);

      setTimeout(() => {
        const firstItem = accountMenuRef.current?.querySelector<HTMLElement>("a,button");
        firstItem?.focus();
      }, 0);

      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          setAccountOpen(false);
          accountBtnRef.current?.focus();
        }
      }
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("mousedown", handleClick);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [accountOpen]);

  const hasSession = Boolean(sessionToken);

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
      setSessionToken(data.token);
      window.dispatchEvent(new Event("session_changed"));
      setTfKey("");
      setVdbKey("");
      setKeysValidating(false);
      setKeyPanelOpen(false);
    } catch {
      setKeysError("Could not validate keys. Check your connection.");
      setKeysValidating(false);
    }
  }

  function clearKeys() {
    localStorage.removeItem("session_token");
    setSessionToken("");
    window.dispatchEvent(new Event("session_changed"));
    setAccountOpen(false);
    window.location.reload();
  }

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const stored = document.documentElement.classList.contains("theme-light") ? "light" : "dark";
    setTheme(stored);
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.remove("theme-dark", "theme-light");
    document.documentElement.classList.add(`theme-${next}`);
  }

  return (
    <>
      <header className="ds-header-nav flex items-center justify-between px-[22px] h-[62px]">
        <Link href="/" className="flex items-center gap-[10px] select-none shrink-0 py-1.5">
          <img src="/brand/TF_Horizontal_light.svg" alt="TinyFish" className="show-on-dark h-[21px] w-auto" />
          <img src="/brand/TF_Horizontal.svg" alt="TinyFish" className="show-on-light h-[21px] w-auto" />
          <span className="text-[20px] font-light text-[var(--c-text-faint)] mx-[5px]">×</span>
          <img src="/brand/videodb-wordmark-dark.png" alt="VideoDB" className="show-on-dark h-[18px] w-auto" />
          <img src="/brand/videodb-wordmark-light.png" alt="VideoDB" className="show-on-light h-[18px] w-auto" />
          <span className="hidden sm:block ml-1.5 h-4 w-px bg-[var(--c-border-strong)]" />
          <span className="hidden sm:inline font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--c-text-subtle)]">Briefing</span>
        </Link>

        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="flex size-11 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-hover)] text-[var(--c-text-muted)] transition-all duration-200 hover:border-[#F24E1E]/60 hover:text-[var(--c-text)] active:scale-[0.95]"
          >
            {theme === "dark" ? (
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            )}
          </button>
          {hasSession ? (
            <Link href="/schedules" className="ds-btn ds-btn--primary ds-btn--sm">
              <CalendarIcon className="size-[15px]" /> Create a Schedule
            </Link>
          ) : (
            <Link href="/schedules" className="ds-btn ds-btn--ghost-dark ds-btn--sm">
              <CalendarIcon className="size-[15px]" /> Create a Schedule
            </Link>
          )}
          <div ref={accountRef} className="relative">
            <button
              ref={accountBtnRef}
              type="button"
              onClick={() => setAccountOpen(!accountOpen)}
              aria-expanded={accountOpen}
              aria-controls="account-dropdown"
              aria-label="Account menu"
              className="flex size-11 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-hover)] text-[var(--c-text-muted)] transition-all duration-200 hover:border-[#F24E1E]/60 hover:text-[var(--c-text)] active:scale-[0.98]"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
            {accountOpen ? (
              <div
                id="account-dropdown"
                ref={accountMenuRef}
                className="absolute right-0 top-full mt-1.5 w-[224px] rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)] animate-rise"
              >
                {hasSession ? (
                  <>
                    <Link
                      href="/me"
                      onClick={() => setAccountOpen(false)}
                      className="flex items-center justify-between rounded-[10px] px-3 py-[9px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:bg-[var(--c-hover)]"
                    >
                      My briefings<ArrowRightIcon className="size-3.5" />
                    </Link>
                    <div className="mx-1.5 my-2 h-px bg-[var(--c-border)]" />
                    <button
                      type="button"
                      onClick={() => setClearConfirm(true)}
                      className="flex w-full items-center rounded-[10px] px-3 py-[9px] text-[13px] font-semibold text-[var(--color-error)] hover:bg-[var(--c-hover)]"
                    >
                      Clear keys
                    </button>
                  </>
                ) : (
                    <button
                    type="button"
                    onClick={() => { setAccountOpen(false); setKeyPanelOpen(true); }}
                    className="flex w-full items-center justify-between rounded-[10px] px-3 py-[9px] text-[13px] font-semibold text-[var(--c-text-muted)] hover:bg-[var(--c-hover)]"
                  >
                    Add API keys<ArrowRightIcon className="size-3.5" />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <ConfirmModal
        open={clearConfirm}
        title="Clear API keys?"
        confirmLabel="Clear keys"
        danger
        onConfirm={clearKeys}
        onClose={() => setClearConfirm(false)}
      >
        <p>This will remove your API keys from this browser. You will need to re-add them to access your schedules and briefings.</p>
      </ConfirmModal>

      {keyPanelOpen ? (
        <KeyModal
          tfKey={tfKey}
          vdbKey={vdbKey}
          onTfKeyChange={setTfKey}
          onVdbKeyChange={setVdbKey}
          onSave={saveKeys}
          validating={keysValidating}
          error={keysError}
          onClose={() => {
            setKeyPanelOpen(false);
            setKeysError("");
            setTfKey("");
            setVdbKey("");
          }}
        />
      ) : null}
    </>
  );
}
