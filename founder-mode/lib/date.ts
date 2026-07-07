export function getVietnamDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Returns the next occurrence of the given hour (Vietnam local time, 24h
// clock) as an ISO string — today if it hasn't happened yet, tomorrow if it
// has. Used for the "next sweep" countdown display. Vietnam has no DST, so
// this stays accurate year-round without extra handling.
export function getNextScheduledRun(hourVietnam = 11): string {
  const now = new Date();
  const vietnamNowStr = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
  const vietnamNow = new Date(vietnamNowStr);
  const next = new Date(vietnamNow);
  next.setHours(hourVietnam, 0, 0, 0);
  if (next.getTime() <= vietnamNow.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  const diffMs = next.getTime() - vietnamNow.getTime();
  return new Date(Date.now() + diffMs).toISOString();
}
