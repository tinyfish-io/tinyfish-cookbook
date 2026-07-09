export async function dispatchGithubSweep(): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const workflowFile = process.env.GITHUB_WORKFLOW_FILE ?? "sweep.yml";

  if (!token || !repo) {
    return { ok: false, reason: "GITHUB_TOKEN or GITHUB_REPO not configured" };
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: process.env.GITHUB_REF ?? "main" }),
  });

  if (!res.ok) {
    return { ok: false, reason: `GitHub API responded ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}
