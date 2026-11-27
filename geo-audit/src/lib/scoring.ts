import type { SelfGeneratedQuestion } from "@/lib/tinyfish";

const ANSWER_SCORE: Record<string, number> = {
  true: 1,
  partial: 0.5,
  false: 0,
};

const IMPORTANCE_WEIGHT: Record<string, number> = {
  high: 1,
  medium: 0.6,
};

export type ImportanceStats = {
  score: number;
  clarityIndex: number;
  total: number;
  answered: number;
  partial: number;
  missing: number;
};

const EMPTY_IMPORTANCE_STATS: ImportanceStats = {
  score: 0,
  clarityIndex: 0,
  total: 0,
  answered: 0,
  partial: 0,
  missing: 0,
};

export type ScoreBreakdown = {
  score: number;
  clarityIndex: number;
  importanceBreakdown: {
    high: ImportanceStats;
    medium: ImportanceStats;
  };
};

function computeImportanceStats(items: SelfGeneratedQuestion[]): ImportanceStats {
  if (!items.length) {
    return EMPTY_IMPORTANCE_STATS;
  }
  let totalWeighted = 0;
  let weights = 0;
  for (const item of items) {
    const answerScore = ANSWER_SCORE[item.answeredInDocs] ?? 0;
    const weight = IMPORTANCE_WEIGHT[item.importance] ?? 0.6;
    totalWeighted += answerScore * weight;
    weights += weight;
  }
  const score = weights ? Math.round((totalWeighted / weights) * 100) : 0;
  const total = items.length;
  const answered = items.filter((q) => q.answeredInDocs === "true").length;
  const partial = items.filter((q) => q.answeredInDocs === "partial").length;
  const missing = items.filter((q) => q.answeredInDocs === "false").length;
  const clarityIndex = Math.round(((answered + partial * 0.5) / total) * 100);
  return { score, clarityIndex, total, answered, partial, missing };
}

export function computeGeoScore(
  questions: SelfGeneratedQuestion[]
): ScoreBreakdown {
  if (!questions.length) {
    return {
      score: 0,
      clarityIndex: 0,
      importanceBreakdown: {
        high: EMPTY_IMPORTANCE_STATS,
        medium: EMPTY_IMPORTANCE_STATS,
      },
    };
  }

  let weightedTotal = 0;
  let weightSum = 0;

  for (const q of questions) {
    const answerScore = ANSWER_SCORE[q.answeredInDocs] ?? 0;
    const weight = IMPORTANCE_WEIGHT[q.importance] ?? 0.6;
    weightedTotal += answerScore * weight;
    weightSum += weight;
  }

  if (weightSum === 0) {
    return {
      score: 0,
      clarityIndex: 0,
      importanceBreakdown: {
        high: EMPTY_IMPORTANCE_STATS,
        medium: EMPTY_IMPORTANCE_STATS,
      },
    };
  }
  const score = Math.round((weightedTotal / weightSum) * 100);

  const total = questions.length;
  const answered = questions.filter((q) => q.answeredInDocs === "true").length;
  const partial = questions.filter((q) => q.answeredInDocs === "partial").length;
  const clarityIndex = Math.round(((answered + partial * 0.5) / total) * 100);

  const high = questions.filter((q) => q.importance === "high");
  const medium = questions.filter((q) => q.importance === "medium");

  return {
    score,
    clarityIndex,
    importanceBreakdown: {
      high: computeImportanceStats(high),
      medium: computeImportanceStats(medium),
    },
  };
}
