const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

export function money(amount: number, currency: string | null): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  const value = amount.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  });
  if (currency === null) return value;
  return `${currency === "INR" ? "Rs" : currency} ${value}`;
}

/** The whole part and the paise apart, because the paise are drawn lighter. */
export function moneyParts(
  amount: number,
  currency: string | null,
): { main: string; minor: string } {
  const [whole, paise = "00"] = amount.toFixed(2).split(".");
  const main = money(Number(whole), currency);
  return { main, minor: `.${paise}` };
}

/** One suffix for a billing period, however the agent wrote it or a saved report kept it. */
export function perPeriod(period: string | null): string {
  const bare = period?.replace(/^\s*(\/|per\b)\s*/i, "").trim();
  if (!bare) return "";
  if (/^(mo|month|monthly)$|billed monthly/i.test(bare)) return "/mo";
  if (/^(yr|year|yearly|annual|annually)$|prepaid/i.test(bare)) return "/yr";
  return `/${bare}`;
}

export function duration(fromIso: string, toIso: string): string {
  const seconds = Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds % 60}s`;
}

const JUST_NOW_SECONDS = 3;

export function ago(iso: string, now: number): string {
  const seconds = Math.round((now - Date.parse(iso)) / 1000);
  if (seconds < JUST_NOW_SECONDS) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}

export function clock(iso: string): string {
  // Newer Intl data puts a narrow no-break space before AM and PM.
  return TIME.format(new Date(iso)).replaceAll(" ", " ");
}

export function dateTime(iso: string): string {
  return `${DAY.format(new Date(iso))}, ${clock(iso)}`;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
