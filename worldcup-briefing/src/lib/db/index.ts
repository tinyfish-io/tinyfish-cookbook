import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.DATABASE_URL?.includes("azure.com") ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool);

export { channels, runs, videoCache, schedules, userKeys, freeRunCounts } from "./schema";
