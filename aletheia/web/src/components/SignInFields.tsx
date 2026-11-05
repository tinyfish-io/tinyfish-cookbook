import type { SyntheticEvent } from "react";
import { useMemo, useState } from "react";

import { dialChoices, visitorDialCode } from "../lib/dialCodes.ts";
import { cleanCode, codeNote } from "../lib/signInCopy.ts";
import type { StepView } from "../lib/types.ts";

type Step<K extends StepView["kind"]> = Extract<StepView, { kind: K }>;

export interface FieldAnswer {
  text: string;
  dialCode?: string;
}

interface FieldProps<K extends StepView["kind"]> {
  step: Step<K>;
  busy: boolean;
  onAnswer: (answer: FieldAnswer) => void;
}

function SubmitButton({ busy, disabled }: { busy: boolean; disabled: boolean }) {
  return (
    <button type="submit" className="btn btn-dark mt-3 w-full" disabled={busy || disabled}>
      {busy ? <span aria-hidden="true" className="spinner border-t-white" /> : null}
      {busy ? "Working" : "Continue"}
    </button>
  );
}

function PhoneField({
  step,
  busy,
  country,
  onAnswer,
}: FieldProps<"identifier"> & { country: string | null }) {
  const { code: siteCode, fixed } = step.dial;
  const [dialCode, setDialCode] = useState(
    siteCode ?? visitorDialCode(country, navigator.languages),
  );
  const [number, setNumber] = useState("");
  const choices = useMemo(dialChoices, []);
  const known = choices.some(({ code }) => code === dialCode);

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    onAnswer({ text: number, dialCode });
    setNumber("");
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="sign-in-phone" className="text-sm text-body">
        Phone number
      </label>
      <div className="mt-1 flex gap-2">
        {fixed ? (
          <span className="field num flex w-auto shrink-0 items-center text-mute">{dialCode}</span>
        ) : (
          <select
            aria-label="Country code"
            className="field w-[104px] shrink-0 px-2"
            value={dialCode}
            onChange={(event) => setDialCode(event.target.value)}
          >
            {known ? null : <option value={dialCode}>{dialCode}</option>}
            {choices.map(({ code, label }) => (
              <option key={label} value={code}>
                {label}
              </option>
            ))}
          </select>
        )}
        <input
          id="sign-in-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus
          required
          className="field num min-w-0 flex-1 text-base"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
        />
      </div>
      <SubmitButton busy={busy} disabled={number.trim().length === 0} />
    </form>
  );
}

const TEXT_FIELD: Record<
  Exclude<Step<"identifier">["accepts"], "phone">,
  { label: string; type: string; inputMode: "email" | "text"; autoComplete: string }
> = {
  email: { label: "Email", type: "email", inputMode: "email", autoComplete: "email" },
  username: { label: "Username", type: "text", inputMode: "text", autoComplete: "username" },
  email_or_phone: {
    label: "Email or phone number",
    type: "text",
    inputMode: "email",
    autoComplete: "username",
  },
};

function TextField({ step, busy, onAnswer }: FieldProps<"identifier">) {
  const [value, setValue] = useState("");
  const accepts = step.accepts === "phone" ? "email_or_phone" : step.accepts;
  const { label, ...input } = TEXT_FIELD[accepts];

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    onAnswer({ text: value.trim() });
    setValue("");
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="sign-in-identifier" className="text-sm text-body">
        {label}
      </label>
      <input
        id="sign-in-identifier"
        {...input}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        required
        className="field mt-1 text-base"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <SubmitButton busy={busy} disabled={value.trim().length === 0} />
    </form>
  );
}

function PasswordField({ busy, onAnswer }: FieldProps<"password">) {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    onAnswer({ text: value });
    setValue("");
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="sign-in-password" className="text-sm text-body">
        Password
      </label>
      <div className="relative mt-1">
        <input
          id="sign-in-password"
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          className="field pr-[72px] text-base"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          type="button"
          aria-pressed={shown}
          className="absolute inset-y-0 right-1 min-w-11 px-2.5 text-sm font-medium text-body hover:text-ink"
          onClick={() => setShown((now) => !now)}
        >
          {shown ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      </div>
      <SubmitButton busy={busy} disabled={value.length === 0} />
    </form>
  );
}

function CodeField({ step, busy, onAnswer }: FieldProps<"code">) {
  const [value, setValue] = useState("");
  const note = codeNote(step);

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    onAnswer({ text: cleanCode(value) });
    setValue("");
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="sign-in-code" className="text-sm text-body">
        Code
      </label>
      <input
        id="sign-in-code"
        type="text"
        inputMode={step.digitsOnly ? "numeric" : "text"}
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        required
        aria-describedby={note ? "sign-in-code-note" : undefined}
        className="field num mt-1 text-center text-[22px] tracking-[0.18em]"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {note ? (
        <p id="sign-in-code-note" className="mt-1 text-[13px] text-mute">
          {note}
        </p>
      ) : null}
      <SubmitButton busy={busy} disabled={cleanCode(value).length === 0} />
    </form>
  );
}

interface SignInFieldProps {
  step: StepView;
  busy: boolean;
  country: string | null;
  onAnswer: (answer: FieldAnswer) => void;
}

/** Holds what is typed only until Continue, when it goes to the server and the field empties. */
export function SignInField({ step, busy, country, onAnswer }: SignInFieldProps) {
  switch (step.kind) {
    case "identifier":
      return step.accepts === "phone" ? (
        <PhoneField step={step} busy={busy} country={country} onAnswer={onAnswer} />
      ) : (
        <TextField step={step} busy={busy} onAnswer={onAnswer} />
      );
    case "password":
      return <PasswordField step={step} busy={busy} onAnswer={onAnswer} />;
    case "code":
      return <CodeField step={step} busy={busy} onAnswer={onAnswer} />;
    default:
      return null;
  }
}
