import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { sendSignInInput, signInScreenUrl } from "../lib/api.ts";
import { InputRelay, keyToInput, toRemotePoint } from "../lib/remoteInput.ts";
import { manualCopy } from "../lib/signInCopy.ts";
import type { ManualReason, ScreenFrame } from "../lib/types.ts";

const SCROLL_STEP = 300;

interface SignInScreenProps {
  signInId: string;
  name: string;
  host: string;
  reason: ManualReason;
  busy: boolean;
  /** Shown when pressing Done did not move things on. */
  message: string | null;
  onDone: () => void;
  onCancel: () => void;
}

/** The fallback: the site itself, full screen, for the one step a form cannot do. */
export function SignInScreen({
  signInId,
  name,
  host,
  reason,
  busy,
  message,
  onDone,
  onCancel,
}: SignInScreenProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const relay = useRef<InputRelay | null>(null);
  const [frame, setFrame] = useState<ScreenFrame | null>(null);
  const [lost, setLost] = useState(false);
  const { title, body } = manualCopy(reason, name);

  if (!relay.current) {
    relay.current = new InputRelay(
      (input) => sendSignInInput(signInId, input),
      () => setLost(true),
    );
  }

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const events = new EventSource(signInScreenUrl(signInId));
    events.addEventListener("frame", (event) => {
      setFrame(JSON.parse((event as MessageEvent<string>).data) as ScreenFrame);
    });
    return () => events.close();
  }, [signInId]);

  function tap(event: MouseEvent<HTMLImageElement>) {
    if (!frame || !image.current) return;
    const point = toRemotePoint(event, image.current.getBoundingClientRect(), frame);
    relay.current?.push({ kind: "click", ...point });
  }

  function key(event: KeyboardEvent<HTMLInputElement>) {
    const input = keyToInput(event.nativeEvent);
    if (input?.kind !== "key" || input.key === "Tab") return;
    event.preventDefault();
    relay.current?.push(input);
  }

  function type(event: ChangeEvent<HTMLInputElement>) {
    const { value } = event.target;
    event.target.value = "";
    if (value) relay.current?.push({ kind: "text", text: value });
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="sign-in-screen-title"
      className="sign-in-screen"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <header className="px-4 pt-3 pb-2 text-center">
        <h2 id="sign-in-screen-title" className="text-base tracking-[-0.01em] wrap-anywhere">
          {title}
        </h2>
        <p className="text-[13px] text-body">{body}</p>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-wash">
        {frame ? (
          <img
            ref={image}
            src={`data:image/jpeg;base64,${frame.data}`}
            alt={`Live view of ${host}`}
            width={frame.width}
            height={frame.height}
            draggable={false}
            onClick={tap}
            className="max-h-full max-w-full cursor-pointer select-none"
          />
        ) : (
          <p role="status" className="flex items-center gap-3 p-4 text-mute">
            <span aria-hidden="true" className="spinner" />
            Opening {host}.
          </p>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-line px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Type into the page you tapped</span>
            <input
              type="text"
              placeholder="Tap a box on the page, then type here"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="field py-2 text-base"
              onChange={type}
              onKeyDown={key}
            />
          </label>
          <button
            type="button"
            className="btn btn-soft btn-sm shrink-0"
            onClick={() => relay.current?.push({ kind: "key", key: "Backspace" })}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn btn-soft btn-sm shrink-0"
            aria-label="Scroll the page down"
            onClick={() => relay.current?.push({ kind: "scroll", dx: 0, dy: SCROLL_STEP })}
          >
            Scroll
          </button>
        </div>
        {lost ? (
          <p role="alert" className="text-center text-[13px] font-medium text-peach-ink">
            That did not reach the page. Please try it again.
          </p>
        ) : null}
        {message ? (
          <p role="alert" className="text-center text-[13px] font-medium text-peach-ink">
            {message}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-soft" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-dark" disabled={busy} onClick={onDone}>
            {busy ? "Checking" : "Done"}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
