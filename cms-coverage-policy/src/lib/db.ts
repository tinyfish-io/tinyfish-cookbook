import postgres from "postgres";

// Raw Postgres over the Supabase session pooler. No supabase-js anywhere.
// Session pooler holds real sessions — keep the pool small; SSE routes are long-lived.
declare global {
  // eslint-disable-next-line no-var
  var __upstreamSql: ReturnType<typeof postgres> | undefined;
}

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error("db: DATABASE_URL is not set — load .env.local");
  }
  globalThis.__upstreamSql ??= postgres(process.env.DATABASE_URL, {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return globalThis.__upstreamSql;
}
