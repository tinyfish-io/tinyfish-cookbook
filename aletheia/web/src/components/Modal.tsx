import type { ReactNode, SyntheticEvent } from "react";
import { useEffect, useRef } from "react";

import { ArrowLeft, Cross } from "./icons.tsx";

interface ModalProps {
  /** Id of the heading inside, which names the dialog. Use `label` when there is no heading. */
  labelledBy?: string;
  label?: string;
  /** Runs for the cross, the Back pill and Escape alike. */
  onDismiss: () => void;
  dismissLabel: string;
  /** The Back pill and the arrow are left out where nothing sits behind the dialog. */
  back?: boolean;
  /** Portrait's small closing line, under the content. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Native modal: the focus trap and Escape come from the browser. */
export function Modal({
  labelledBy,
  label,
  onDismiss,
  dismissLabel,
  back = true,
  footer,
  className = "max-w-[420px]",
  children,
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function cancel(event: SyntheticEvent) {
    event.preventDefault();
    onDismiss();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={labelledBy}
      aria-label={label}
      onCancel={cancel}
      className="modal"
    >
      <div
        className={`rise w-full rounded-card bg-white p-5 text-text shadow-card sm:p-6 ${className}`}
      >
        <div className="flex items-center justify-between">
          {back ? (
            <button
              type="button"
              className="round-button"
              aria-label={dismissLabel}
              onClick={onDismiss}
            >
              <ArrowLeft />
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="round-button"
            aria-label={dismissLabel}
            onClick={onDismiss}
          >
            <Cross />
          </button>
        </div>
        {children}
        {footer ? <p className="mt-5 text-center text-sm text-mute">{footer}</p> : null}
      </div>
      {back ? (
        <button type="button" className="back-pill" onClick={onDismiss}>
          <ArrowLeft />
          Back
        </button>
      ) : null}
    </dialog>
  );
}
