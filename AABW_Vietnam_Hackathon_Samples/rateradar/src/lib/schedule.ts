// One sweep per day, fixed at 14:00 Vietnam time (Asia/Ho_Chi_Minh, UTC+7),
// matching the real-world cadence retailers actually change price/stock at —
// not a fake "every N minutes" polling loop.
export const SWEEP_HOUR_ICT = 14;

function nowInVietnam(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return new Date(
    Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      Number(get("hour")) - 7, // convert Vietnam wall-clock back to UTC instant
      Number(get("minute")),
      Number(get("second"))
    )
  );
}

export function getNextSweepAt(fromISO?: string): string {
  const nowVN = nowInVietnam();
  const next = new Date(nowVN);
  next.setUTCHours(SWEEP_HOUR_ICT - 7, 0, 0, 0);
  if (next.getTime() <= nowVN.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

export function isSweepDue(lastSweepAtISO: string | null): boolean {
  if (!lastSweepAtISO) return true;
  const last = new Date(lastSweepAtISO);
  const nowVN = nowInVietnam();
  // Due if the last sweep happened before today's 14:00 ICT mark and we're
  // currently past it.
  const todayMark = new Date(nowVN);
  todayMark.setUTCHours(SWEEP_HOUR_ICT - 7, 0, 0, 0);
  return nowVN.getTime() >= todayMark.getTime() && last.getTime() < todayMark.getTime();
}

export function formatVietnamTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(new Date(iso)) + " ICT";
}
