import type { ReactNode } from "react";
import { useState } from "react";

import { Modal } from "./Modal.tsx";

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not work.");
      setBusy(false);
    }
  }

  return (
    <Modal
      labelledBy="confirm-title"
      onDismiss={onClose}
      dismissLabel="Keep it and close"
      footer="This cannot be undone."
    >
      <div className="mt-2 text-center">
        <h2 id="confirm-title" className="text-xl tracking-[-0.02em]">
          {title}
        </h2>
        <div className="mt-2 wrap-anywhere text-body">{children}</div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-center text-peach-ink">
          {error}
        </p>
      ) : null}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-soft" onClick={onClose}>
          Keep it
        </button>
        <button
          type="button"
          className="btn btn-dark"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
