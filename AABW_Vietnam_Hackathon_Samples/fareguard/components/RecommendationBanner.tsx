import type { RouteRecommendation, RouteCode, ScheduleMeta } from "@/lib/types";
import { formatDate } from "@/lib/format";
import Countdown from "./Countdown";
import ConfidenceGauge from "./ConfidenceGauge";

const CONFIDENCE_PERCENT: Record<RouteRecommendation["confidence"], number> = {
  low: 42,
  medium: 68,
  high: 91,
};

export default function RecommendationBanner({
  recommendations,
  routeCode,
  meta,
}: {
  recommendations: RouteRecommendation[];
  routeCode: RouteCode;
  meta: ScheduleMeta | null;
}) {
  const rec = recommendations.find((r) => r.routeCode === routeCode);
  const nextAnalyzeAt =
    meta?.lastAnalyzeAt && meta.analyzeIntervalMs
      ? new Date(new Date(meta.lastAnalyzeAt).getTime() + meta.analyzeIntervalMs).toISOString()
      : null;

  if (!rec) {
    return (
      <div className="card-surface rounded-xl px-5 py-4 text-sm text-text-muted flex items-center justify-between flex-wrap gap-2">
        <span>No recommendation yet for this route.</span>
        <span className="text-xs">
          Next AI analysis: <Countdown targetIso={nextAnalyzeAt} />
        </span>
      </div>
    );
  }

  return (
    <div className="card-surface rounded-xl px-5 py-4 flex items-center justify-between gap-5 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M9 18h6M10 22h4M12 2a6 6 0 00-4 10.5c.5.5 1 1.2 1 2.5h6c0-1.3.5-2 1-2.5A6 6 0 0012 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm">
            Book by <span className="font-medium">{formatDate(rec.bookByDate)}</span>
          </p>
          <p className="text-xs text-text-secondary mt-1 max-w-md">{rec.recommendation}</p>
          <p className="text-[11px] text-text-muted mt-2">
            Next analysis: <Countdown targetIso={nextAnalyzeAt} />
          </p>
        </div>
      </div>
      <ConfidenceGauge percent={CONFIDENCE_PERCENT[rec.confidence]} />
    </div>
  );
}
