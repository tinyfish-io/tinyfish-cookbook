export function getVietnamDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Next occurrence of the given hour (Vietnam local time). Used for display
// only — actual scheduling is a daily GitHub Actions cron that then checks
// per-search whether 48h have passed, since cron doesn't cleanly express
// "every 2 days."
export function getNextScheduledRun(hourVietnam = 11.5): string {
  const now = new Date();
  const vietnamNowStr = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
  const vietnamNow = new Date(vietnamNowStr);
  const next = new Date(vietnamNow);
  const hour = Math.floor(hourVietnam);
  const minute = Math.round((hourVietnam - hour) * 60);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= vietnamNow.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  const diffMs = next.getTime() - vietnamNow.getTime();
  return new Date(Date.now() + diffMs).toISOString();
}

export function hoursSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}
