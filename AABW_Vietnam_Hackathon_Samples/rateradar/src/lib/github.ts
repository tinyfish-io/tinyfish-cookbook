// Lets the Vercel app trigger the GitHub Actions sweep workflow remotely
// instead of running it inline — avoids Vercel's function duration limits
// (especially relevant on the free Hobby plan, capped at 60s) for a task
// that involves real multi-step browser agents across 7 banks.
export async function dispatchSweepWorkflow(): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // e.g. "yourname/rateradar"
  if (!token || !repo) return false;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/sweep.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref: "main" })
    });
    if (!res.ok) {
      console.error(`[github] dispatch failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[github] dispatch error:", err);
    return false;
  }
}
