import type { StepRecord } from "../tinyfish/types.ts";
import type { EvidencePage } from "./evidence.ts";
import type { Screenshot } from "./types.ts";

const STOP_WORDS = new Set(
  "a an and are as at be by for from in into is it its of on or page shown the this to was were with".split(
    " ",
  ),
);
const READS_THE_PAGE = /^(check|extract|get|view|read|review|understand|inspect|record)\b/i;
const MOVES_PAGE = /^(open|navigate|go to|visit|load|proceed)\b/i;
// The agent's last action is writing up, and it often has no stored image.
const WRITES_UP = /^(report|finish|complete|compile|task completed)\b/i;
const NOTE_WORDS = 24;

/** A step that moves to a new page can be caught mid-navigation, with nothing on screen yet. */
export function movesPage(action: string | null): boolean {
  return MOVES_PAGE.test(action ?? "");
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word)),
  );
}

function pageWords(page: EvidencePage): Set<string> {
  const note = (page.note ?? "").split(/\s+/).slice(0, NOTE_WORDS).join(" ");
  return words(`${page.name} ${page.url ?? ""} ${note}`);
}

function score(page: Set<string>, step: StepRecord): number {
  const action = step.action ?? "";
  const shared = [...words(action)].filter((word) => page.has(word)).length;
  return shared === 0 ? 0 : shared + (READS_THE_PAGE.test(action) ? 0.75 : 0);
}

/**
 * The agent numbers pages; TinyFish numbers actions, and only actions have screenshots.
 * Pages and actions happen in the same order, so this finds the best in-order match of each
 * page's words to an action's words, giving each page its own action while there are enough.
 */
export function locateScreenshots(
  pages: readonly EvidencePage[],
  actions: readonly StepRecord[],
): Map<number, Screenshot> {
  const shots = actions.filter(
    (step) => step.screenshot !== null && !WRITES_UP.test(step.action ?? ""),
  );
  const located = new Map<number, Screenshot>();
  if (pages.length === 0 || shots.length === 0) return located;

  const pageSets = pages.map(pageWords);
  // best[p][a]: top score for pages p.. when page p may use actions a.. onward.
  const best = pageSets.map(() => Array.from({ length: shots.length + 2 }, () => 0));
  for (let p = pages.length - 1; p >= 0; p -= 1) {
    const row = best[p] as number[];
    const next = best[p + 1];
    for (let a = shots.length - 1; a >= 0; a -= 1) {
      const take = score(pageSets[p] as Set<string>, shots[a] as StepRecord) + (next?.[a + 1] ?? 0);
      row[a] = Math.max(take, row[a + 1] as number);
    }
  }

  let a = 0;
  for (let p = 0; p < pages.length; p += 1) {
    const row = best[p] as number[];
    const lastFree = Math.max(a, shots.length - (pages.length - p));
    while (a < lastFree && row[a + 1] === row[a]) a += 1;
    const shot = shots[a] as StepRecord;
    located.set((pages[p] as EvidencePage).step, { stepId: shot.id, action: shot.action });
    a = Math.min(a + 1, shots.length - 1);
  }
  return located;
}
