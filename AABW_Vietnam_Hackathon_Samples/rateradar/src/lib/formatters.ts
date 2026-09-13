export function formatVND(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function seedRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  h = Math.abs(h) || 1;
  return () => {
    h = (h * 9301 + 49297) % 233280;
    return Math.abs(h) / 233280;
  };
}

export function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Loans: lower rate is better. Savings: higher yield is better.
export function isBetterRate(kind: "savings" | "loan", candidate: number, baseline: number) {
  return kind === "savings" ? candidate > baseline : candidate < baseline;
}
