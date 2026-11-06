// Shared constants and small helpers.

export const verdicts = {
  SUPPORTED: { label: "Supported", tone: "supported" },
  REFUTED: { label: "Refuted", tone: "refuted" },
  INSUFFICIENT_EVIDENCE: { label: "Insufficient evidence", tone: "insufficient" },
  UNVERIFIED_NO_AUTHORITATIVE_SOURCES: { label: "Unverified", tone: "unverified" },
};

export const getSourceUrl = (item) => item.source_url || item.url || "#";

export const getDomain = (item) => (item.domain || "").replace(/^www\./, "");

export function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  for (const [name, size] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "Just now";
}
