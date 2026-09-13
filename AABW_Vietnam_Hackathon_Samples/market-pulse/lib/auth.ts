export function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — local dev convenience
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
