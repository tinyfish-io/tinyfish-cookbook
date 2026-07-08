// Protects the POST trigger endpoints so a random visitor can't hit your
// deployed URL and burn TinyFish/Groq credits. Vercel Cron automatically
// sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set as an
// env var — the GitHub Actions workflow (see .github/workflows/sweep.yml)
// sends the same header manually.
export function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — local dev convenience
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
