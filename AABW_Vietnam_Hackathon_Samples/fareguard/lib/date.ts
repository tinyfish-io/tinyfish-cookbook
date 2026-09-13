// Vietnam is UTC+7. Using the server's UTC clock for "today" was wrong —
// anywhere from 17:00 UTC onward, Vietnam has already rolled over to the
// next calendar day while the server (e.g. a GitHub Actions runner, always
// UTC) still thinks it's the previous one.
export function getVietnamDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
