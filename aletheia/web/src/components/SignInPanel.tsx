import { useEffect, useRef, useState } from "react";

import { actOnSignIn, getSignIn, signOut, startSignIn } from "../lib/api.ts";
import { errorLine, question, viewportForScreen } from "../lib/signInCopy.ts";
import { siteName } from "../lib/sites.ts";
import type { SignInAction, SignInView, StepView } from "../lib/types.ts";
import { Modal } from "./Modal.tsx";
import type { FieldAnswer } from "./SignInFields.tsx";
import { SignInField } from "./SignInFields.tsx";
import { SignInScreen } from "./SignInScreen.tsx";

const OPENING_POLL_MS = 1000;
const CODE_POLL_MS = 6000;

function Waiting({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-3 py-8 text-mute">
      <span aria-hidden="true" className="spinner" />
      {text}
    </p>
  );
}

function SiteOptions({
  step,
  busy,
  onChoose,
}: {
  step: StepView;
  busy: boolean;
  onChoose: (id: string) => void;
}) {
  const options = step.options ?? [];
  if (options.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {options.map(({ id, label }) => (
        <li key={id}>
          <button
            type="button"
            className={`btn w-full whitespace-normal ${step.kind === "choice" ? "btn-dark" : "btn-soft"}`}
            disabled={busy}
            onClick={() => onChoose(id)}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface SignInPanelProps {
  url: string;
  host: string;
  /** Where the sign-in browser should appear to be, and the default phone code. */
  country: string | null;
  onReady: (signIn: SignInView) => void;
  /** The panel closed with no sign-in left behind. */
  onClosed: () => void;
}

export function SignInPanel({ url, host, country, onReady, onClosed }: SignInPanelProps) {
  const opened = useRef(false);
  const abandoned = useRef(false);
  const [signIn, setSignIn] = useState<SignInView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const name = siteName(host, signIn?.name);
  const step = signIn?.step ?? null;

  function show(view: SignInView) {
    if (view.state === "ready") {
      onReady(view);
      return;
    }
    setSignIn(view);
  }

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    startSignIn(url, country).then(
      (view) => {
        if (abandoned.current) {
          void signOut(view.id).catch(() => undefined);
          return;
        }
        setSignIn(view);
      },
      (error: unknown) => {
        setEnded(true);
        setMessage(error instanceof Error ? error.message : "The sign-in could not start.");
      },
    );
  }, [url]);

  const signInId = signIn?.id;
  const kind = step?.kind;

  useEffect(() => {
    if (!signInId || kind !== "opening") return;
    const timer = setInterval(() => {
      getSignIn(signInId).then(setSignIn, () => undefined);
    }, OPENING_POLL_MS);
    return () => clearInterval(timer);
  }, [signInId, kind]);

  // A site's resend button often stays off for a while, and the panel's should follow it.
  useEffect(() => {
    if (!signInId || kind !== "code") return;
    const timer = setInterval(() => {
      actOnSignIn(signInId, { kind: "refresh" }).then(show, () => undefined);
    }, CODE_POLL_MS);
    return () => clearInterval(timer);
  }, [signInId, kind]);

  async function act(action: SignInAction) {
    if (!signInId) return;
    setBusy(true);
    setMessage(null);
    try {
      show(await actOnSignIn(signInId, action));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  function answer(given: FieldAnswer) {
    if (!step) return;
    void act({ kind: "answer", stepId: step.id, ...given });
  }

  // The live page is laid out for the space the visitor has, then shown at that size.
  const manual = kind === "manual";
  useEffect(() => {
    if (!signInId || !manual) return;
    const size = viewportForScreen({ width: window.innerWidth, height: window.innerHeight });
    actOnSignIn(signInId, { kind: "manual", ...size }).then(show, () => undefined);
  }, [signInId, manual]);

  async function close() {
    abandoned.current = true;
    if (signIn && !ended) await signOut(signIn.id).catch(() => undefined);
    onClosed();
  }

  if (signIn && step?.kind === "manual") {
    return (
      <SignInScreen
        signInId={signIn.id}
        name={name}
        host={host}
        reason={step.reason}
        busy={busy}
        message={message}
        onDone={() => void act({ kind: "resume" })}
        onCancel={() => void close()}
      />
    );
  }

  const asking = step?.kind === "identifier" || step?.kind === "password" || step?.kind === "code";
  const heading = step ? question(step, name) : `Signing in to ${name}`;
  const problem = step ? errorLine(step, name) : null;

  return (
    <Modal
      labelledBy="sign-in-title"
      onDismiss={() => void close()}
      dismissLabel={ended ? "Close" : "Cancel and sign out"}
      footer={
        <>
          You&rsquo;re signing in to {name} itself. Aletheia never keeps your password or codes, and
          it signs out and deletes the session after this one check. This window closes after about
          15 minutes without activity.
        </>
      }
    >
      <div className="mt-1 text-center">
        <h2 id="sign-in-title" className="text-xl tracking-[-0.02em] wrap-anywhere">
          {heading}
        </h2>
        {signIn?.notice ? <p className="mt-1.5 text-[13px] text-mute">{signIn.notice}</p> : null}
      </div>

      <div className="mt-4">
        {!ended && (!step || step.kind === "opening" || step.kind === "signed_in") ? (
          <Waiting
            text={step?.kind === "signed_in" ? `Saving your ${name} sign-in.` : `Opening ${name}.`}
          />
        ) : null}

        {step?.kind === "failed" ? (
          <p role="alert" className="py-4 text-center font-medium text-peach-ink">
            {name} could not be opened. Your report is unchanged.
          </p>
        ) : null}

        {step ? (
          // A new question gets a new, empty field, so an answer never lingers on screen.
          <fieldset key={step.id} disabled={busy}>
            <SignInField step={step} busy={busy} country={country} onAnswer={answer} />
          </fieldset>
        ) : null}

        {problem ? (
          <p role="alert" className="mt-3 text-center font-medium text-peach-ink">
            {problem}
          </p>
        ) : null}
        {message ? (
          <p role="alert" className="mt-3 text-center font-medium text-peach-ink">
            {message}
          </p>
        ) : null}

        {step ? (
          <SiteOptions
            step={step}
            busy={busy}
            onChoose={(optionId) => void act({ kind: "choose", optionId })}
          />
        ) : null}

        {step?.kind === "code" && step.resend !== "none" ? (
          <p className="mt-3 text-center text-sm text-body">
            Did not get it?{" "}
            <button
              type="button"
              className="link inline-flex min-h-11 items-center font-medium sm:min-h-6"
              disabled={busy || step.resend === "waiting"}
              onClick={() => void act({ kind: "resend" })}
            >
              {step.resend === "waiting" ? "You can ask again soon" : "Send the code again"}
            </button>
          </p>
        ) : null}

        {asking || step?.kind === "choice" ? (
          <div className="mt-2 flex flex-wrap justify-center gap-x-5 text-sm text-body">
            <button
              type="button"
              className="link inline-flex min-h-11 items-center sm:min-h-8"
              disabled={busy}
              onClick={() => void act({ kind: "restart" })}
            >
              Start again
            </button>
            <button
              type="button"
              className="link inline-flex min-h-11 items-center sm:min-h-8"
              disabled={busy}
              onClick={() =>
                void act({
                  kind: "manual",
                  ...viewportForScreen({ width: window.innerWidth, height: window.innerHeight }),
                })
              }
            >
              Open {name}&rsquo;s page
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
