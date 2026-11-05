/** Agents name their last step this way, and one slow page early on does not. */
const WRAP_UP = /\b(report\w*|finish\w*|stop(ped|ping|s)?|summari[sz]\w*|final answer)\b/i;

/**
 * A run gives no sign that it is writing up, so a quiet spell has to be read. It only means that
 * near the end: a single step can take a minute when a page loads slowly.
 */
export function isWritingUp(
  lastStep: string | undefined,
  now: Date,
  expectedBy: string | null,
): boolean {
  if (expectedBy !== null && now.getTime() >= Date.parse(expectedBy)) return true;
  return WRAP_UP.test(lastStep ?? "");
}
