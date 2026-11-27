import { FAMILY_WEIGHTS, type Family } from "./sources";

// Direction Score: weighted composite of per-family reads, renormalized over
// the families that actually reported (design: "Leadership is excluded until
// EDGAR completes; remaining weights are renormalized").

export type FamilyScores = Partial<Record<Family, { score: number; sources: number }>>;

export function familyScores(reads: { family: Family; read: number | null }[]): FamilyScores {
  const byFamily: FamilyScores = {};
  for (const { family, read } of reads) {
    if (read == null) continue;
    const bucket = (byFamily[family] ??= { score: 0, sources: 0 });
    bucket.score += read;
    bucket.sources += 1;
  }
  for (const family of Object.keys(byFamily) as Family[]) {
    const bucket = byFamily[family]!;
    bucket.score = Math.round(bucket.score / bucket.sources);
  }
  return byFamily;
}

export function directionScore(families: FamilyScores): { score: number | null; provisional: boolean } {
  const present = Object.keys(families) as Family[];
  if (present.length === 0) return { score: null, provisional: true };
  const totalWeight = present.reduce((sum, f) => sum + FAMILY_WEIGHTS[f], 0);
  const weighted = present.reduce((sum, f) => sum + families[f]!.score * (FAMILY_WEIGHTS[f] / totalWeight), 0);
  return { score: Math.round(weighted), provisional: present.length < 4 };
}
