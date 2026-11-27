const SHORTEST_FOR_ONE_SLIP = 5;
const SHORTEST_FOR_TWO_SLIPS = 8;

/** Edits between two words, where swapping two neighbouring letters counts as one. */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => rows[i]?.[j] ?? Number.POSITIVE_INFINITY;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const changed = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + changed);
      if (a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      const row = rows[i];
      if (row) row[j] = best;
    }
  }
  return at(a.length, b.length);
}

/**
 * True for a likely typo of `name`. People rarely miss a first letter, and asking for it keeps
 * "tomato" from reading as "zomato".
 */
export function isTypoOf(word: string, name: string): boolean {
  if (word === name || word[0] !== name[0]) return false;
  if (name.length < SHORTEST_FOR_ONE_SLIP || word.length < SHORTEST_FOR_ONE_SLIP - 1) return false;
  const allowed = name.length >= SHORTEST_FOR_TWO_SLIPS ? 2 : 1;
  return Math.abs(word.length - name.length) <= allowed && editDistance(word, name) <= allowed;
}
