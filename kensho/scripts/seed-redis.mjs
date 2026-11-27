// One-time copy of the local SQLite data (data/kensho.db) into Upstash Redis, so a Vercel
// deployment that uses Redis starts with the same papers, searches and drawn manga.
//   KV_REST_API_URL=… KV_REST_API_TOKEN=… node scripts/seed-redis.mjs
// Existing Redis keys with the same names are overwritten; nothing else is touched.

import { DatabaseSync } from "node:sqlite";

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TCP_URL = URL && TOKEN ? null : process.env.REDIS_URL || process.env.KV_URL;
if (!(URL && TOKEN) && !TCP_URL) {
  console.error("Set REDIS_URL, or KV_REST_API_URL and KV_REST_API_TOKEN, from your Vercel project's environment variables first.");
  process.exit(1);
}

async function pipeline(cmds) {
  if (TCP_URL) {
    const { createClient } = await import("redis");
    const client = createClient({ url: TCP_URL });
    await client.connect();
    for (const c of cmds) await client.sendCommand(c.map(String));
    await client.quit();
    return;
  }
  for (let i = 0; i < cmds.length; i += 50) {
    const res = await fetch(`${URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(cmds.slice(i, i + 50)),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  }
}

const db = new DatabaseSync("data/kensho.db", { readOnly: true });
const cmds = [];

for (const r of db.prepare("SELECT id, data FROM papers").all()) cmds.push(["SET", `paper:${r.id}`, r.data]);

for (const r of db.prepare("SELECT * FROM searches").all()) {
  const rec = { query: r.query, paperIds: JSON.parse(r.paper_ids), sources: JSON.parse(r.sources), dedupedFrom: r.deduped_from, createdAt: r.created_at };
  cmds.push(["SET", `search:${r.query_key}`, JSON.stringify(rec)], ["ZADD", "searches", Date.parse(r.created_at), r.query_key]);
}

let drawn = 0;
for (const r of db.prepare("SELECT * FROM processed").all()) {
  const rec = {
    acquisition: r.acquisition ? JSON.parse(r.acquisition) : null,
    analysis: r.analysis ? JSON.parse(r.analysis) : null,
    story: r.story ? JSON.parse(r.story) : null,
    model: r.model ?? null,
  };
  cmds.push(["SET", `processed:${r.paper_id}`, JSON.stringify(rec)]);
  if (rec.story?.chapters.some(Boolean)) {
    cmds.push(["ZADD", "drawn", Date.parse(r.updated_at), r.paper_id]);
    drawn++;
  }
}

for (const r of db.prepare("SELECT paper_id, data FROM jobs").all()) cmds.push(["SET", `job:${r.paper_id}`, r.data]);

await pipeline(cmds);
console.log(`Copied ${cmds.length} commands to Redis (${drawn} drawn manga).`);
