"use client";

import ModalShell from "@/components/ModalShell";
import { CloseIcon } from "@/components/Icons";

type KeyModalProps = {
  tfKey: string;
  vdbKey: string;
  onTfKeyChange: (value: string) => void;
  onVdbKeyChange: (value: string) => void;
  onSave: () => void;
  validating: boolean;
  error: string;
  onClose: () => void;
};

export default function KeyModal({
  tfKey,
  vdbKey,
  onTfKeyChange,
  onVdbKeyChange,
  onSave,
  validating,
  error,
  onClose,
}: KeyModalProps) {
  return (
    <ModalShell
      labelledBy="key-modal-title"
      onClose={onClose}
      closeOnBackdrop={!validating}
      className="animate-rise w-full max-w-[430px] rounded-t-[20px] border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:rounded-[20px]"
    >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="key-modal-title" className="text-[19px] font-bold tracking-[-0.01em] text-[var(--c-text)]">Add your API keys</h2>
            <p className="mt-[7px] text-[13px] leading-relaxed text-[var(--c-text-subtle)]">
              Your keys are sent once for validation, then stored encrypted and represented locally by a session token.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={validating}
            aria-label="Close"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--c-hover-2)] text-[var(--c-text-subtle)] hover:text-[var(--c-text-muted)] disabled:opacity-50"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {error ? (
          <div role="alert" className="animate-rise mt-4 rounded-[11px] border border-[#E5484D]/40 bg-[#E5484D]/10 px-[13px] py-[11px] text-[13px] text-[#E5484D]">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <div className="mb-[7px] flex items-center justify-between">
              <label htmlFor="tf-key" className="ds-field-label ds-field-label--on-dark">TinyFish API key</label>
              <a
                href="https://agent.tinyfish.ai/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-semibold text-[#F24E1E] no-underline hover:underline"
              >
                Get a key →
              </a>
            </div>
            <input
              id="tf-key"
              type="password"
              value={tfKey}
              onChange={(e) => onTfKeyChange(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              aria-invalid={Boolean(error)}
              disabled={validating}
              className="ds-input ds-input--dark w-full disabled:opacity-50"
            />
          </div>
          <div>
            <div className="mb-[7px] flex items-center justify-between">
              <label htmlFor="vdb-key" className="ds-field-label ds-field-label--on-dark">VideoDB API key</label>
              <a
                href="https://console.videodb.io"
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-semibold text-[#F24E1E] no-underline hover:underline"
              >
                Get a key →
              </a>
            </div>
            <input
              id="vdb-key"
              type="password"
              value={vdbKey}
              onChange={(e) => onVdbKeyChange(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              aria-invalid={Boolean(error)}
              disabled={validating}
              className="ds-input ds-input--dark w-full disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mt-[22px] flex gap-[10px]">
          <button
            type="button"
            onClick={onClose}
            disabled={validating}
            className="ds-btn ds-btn--ghost-dark shrink-0 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={validating || !tfKey.trim() || !vdbKey.trim()}
            className="ds-btn ds-btn--primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {validating ? "Checking keys..." : "Save keys"}
          </button>
        </div>
    </ModalShell>
  );
}
