// Applies db/schema.sql to DATABASE_URL. Idempotent.
// Run: bash -c 'set -a; source .env.local; set +a; node scripts/apply-schema.mjs'
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("apply-schema: failed because DATABASE_URL is not set — load .env.local first");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const ddl = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

try {
  await sql.unsafe(ddl);
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log(`apply-schema: ok — ${tables.length} tables present: ${tables.map(t => t.table_name).join(", ")}`);
} catch (err) {
  console.error(`apply-schema: failed because ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
