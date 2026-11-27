import type { AnchorHTMLAttributes, CSSProperties, MouseEvent, ReactNode } from "react";
import { useEffect } from "react";

import { moneyParts } from "../lib/format.ts";
import { severityLevel } from "../lib/report.ts";
import { avatarTone, siteName } from "../lib/sites.ts";
import type { Pill as PillValue } from "../lib/story.ts";
import type { PatternStatus, Severity } from "../lib/types.ts";
import { navigate } from "../lib/useRoute.ts";
import { Check } from "./icons.tsx";

export function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    const plain = !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (!href || event.defaultPrevented || !plain || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  }
  return <a href={href} onClick={follow} {...props} />;
}

export function Pill({ tone, text, className = "" }: PillValue & { className?: string }) {
  return (
    <span className={`pill pill-${tone} ${className}`}>
      {tone === "found" || tone === "live" ? <span aria-hidden="true" className="dot" /> : null}
      {tone === "clean" ? <Check size={13} /> : null}
      {text}
    </span>
  );
}

const STATUS: Record<PatternStatus, { text: string; tone: string }> = {
  found: { text: "Found", tone: "pill-found" },
  not_found: { text: "Not found", tone: "pill-clean" },
  not_checked: { text: "Not checked", tone: "pill-unchecked" },
  not_applicable: { text: "Doesn't apply", tone: "pill-na" },
};

interface StatusPillProps {
  status: PatternStatus;
  /** Position among the pills landing together, so they pop one after another. */
  popOrder?: number;
  /** Says what was found in place of the bare status. */
  label?: string;
}

export function StatusPill({ status, popOrder, label }: StatusPillProps) {
  const { text, tone } = STATUS[status];
  const popping = status === "found" && popOrder !== undefined;
  const style = popping
    ? ({ "--pop-delay": `${Math.min(popOrder, 4) * 120}ms` } as CSSProperties)
    : undefined;
  return (
    <span className={`pill ${tone} ${popping ? "pop-in" : ""}`} style={style}>
      {label ? `${label}, ${text.toLowerCase()}` : text}
    </span>
  );
}

/** The level in words, with a three-bar meter for scanning a list. */
export function SeverityTag({ severity }: { severity: Severity }) {
  const { text, bars } = severityLevel(severity);
  return (
    <span className={`severity severity-${severity}`}>
      <span aria-hidden="true" className="severity-meter">
        {[1, 2, 3].map((bar) => (
          <span key={bar} className={bar <= bars ? "on" : undefined} />
        ))}
      </span>
      {text}
      <span className="sr-only"> severity</span>
    </span>
  );
}

interface MoneyProps {
  amount: number;
  currency: string | null;
  /** Such as "/mo", drawn in place of a zero paise part. */
  suffix?: string;
  /** Leaves off a zero paise part, for a price that only sets up the next one. */
  plain?: boolean;
}

export function Money({ amount, currency, suffix = "", plain = false }: MoneyProps) {
  const { main, minor } = moneyParts(amount, currency);
  if (plain && minor === ".00") return <span className="num">{main}</span>;
  return (
    <span className="num">
      {main}
      <span className="cents">{suffix && minor === ".00" ? suffix : `${minor}${suffix}`}</span>
    </span>
  );
}

export function SiteAvatar({ host, small = false }: { host: string; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`avatar avatar-${avatarTone(host)} ${small ? "avatar-sm" : ""}`}
    >
      {siteName(host).charAt(0)}
    </span>
  );
}

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title === "Aletheia" ? title : `${title} | Aletheia`;
  }, [title]);
}

export function Notice({
  title,
  children,
  action,
  level: Heading = "h2",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** h1 when the notice is the whole page. */
  level?: "h1" | "h2";
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center sm:py-16">
      <Heading className="text-2xl">{title}</Heading>
      {children ? <div className="max-w-md text-mute">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-3 py-16 text-mute">
      <span aria-hidden="true" className="spinner" />
      {what}
    </p>
  );
}

export function Failed({
  message,
  onRetry,
  level = "h2",
}: {
  message: string;
  onRetry: () => void;
  level?: "h1" | "h2";
}) {
  return (
    <div role="alert">
      <Notice
        title="That did not work"
        level={level}
        action={
          <button type="button" className="btn btn-soft" onClick={onRetry}>
            Try again
          </button>
        }
      >
        {message}
      </Notice>
    </div>
  );
}
