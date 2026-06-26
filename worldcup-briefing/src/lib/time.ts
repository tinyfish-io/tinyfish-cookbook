export function relativeTimeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function relativeTimeUntil(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMs <= 0 && Math.abs(diffMs) < 60000) return "now";
  if (diffMs < 0) {
    const pastSec = Math.floor(-diffMs / 1000);
    const pastMin = Math.floor(pastSec / 60);
    const pastHr = Math.floor(pastMin / 60);
    const pastDay = Math.floor(pastHr / 24);
    if (pastDay > 30) {
      const months = Math.floor(pastDay / 30);
      return months === 1 ? "1 month ago" : `${months} months ago`;
    }
    if (pastDay > 0) return pastDay === 1 ? "1 day ago" : `${pastDay} days ago`;
    if (pastHr > 0) return pastHr === 1 ? "1 hour ago" : `${pastHr} hours ago`;
    if (pastMin > 0) return pastMin === 1 ? "1 minute ago" : `${pastMin} minutes ago`;
    return "just now";
  }

  if (diffDay > 30) {
    const months = Math.floor(diffDay / 30);
    return `in ${months} month${months === 1 ? "" : "s"}`;
  }
  if (diffDay > 0) return `in ${diffDay} day${diffDay === 1 ? "" : "s"}`;
  if (diffHr > 0) return `in ${diffHr} hour${diffHr === 1 ? "" : "s"}`;
  if (diffMin > 0) return `in ${diffMin} minute${diffMin === 1 ? "" : "s"}`;
  return "in a moment";
}

export function formatHourMinute(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}
