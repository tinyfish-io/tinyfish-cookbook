const PROBE_TIMEOUT_MS = 3000;

/** Any answer counts, since a shop that turns bots away is still a shop. Search hits are public. */
export async function siteAnswers(url: string): Promise<boolean> {
  try {
    await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return true;
  } catch {
    return false;
  }
}
