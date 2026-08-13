#!/usr/bin/env node
// CI gate: skill frontmatter validity (name/description present, description
// <=1024 chars — Codex hard limit), generated variants in sync with
// skills-src, and marketplace.json plugin paths resolve (regression: #241).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

execSync(`node ${join(ROOT, "scripts", "generate-harness-skills.mjs")}`, { stdio: "pipe" });
const drift = execSync("git status --porcelain -- plugins skills", { cwd: ROOT }).toString().trim();
if (drift) fail(`generated skills out of sync with skills-src — run scripts/generate-harness-skills.mjs and commit:\n${drift}`);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name === "SKILL.md" ? [join(dir, e.name)] : []
  );
for (const f of [...walk(join(ROOT, "plugins")), ...walk(join(ROOT, "skills", "tinyfish-doctor"))]) {
  const src = readFileSync(f, "utf8");
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) { fail(`${f}: missing frontmatter`); continue; }
  const desc = m[1].match(/^description:\s*(.*)$/m)?.[1] ?? "";
  const name = m[1].match(/^name:\s*(.*)$/m)?.[1] ?? "";
  if (!name) fail(`${f}: missing name`);
  if (!desc) fail(`${f}: missing description`);
  if (desc.length > 1024) fail(`${f}: description ${desc.length} chars > 1024 (Codex limit)`);
}

const marketplace = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf8"));
for (const p of marketplace.plugins ?? []) {
  const dir = join(ROOT, p.source);
  if (!existsSync(dir)) fail(`marketplace.json: plugin source does not resolve: ${p.source}`);
  if (!existsSync(join(dir, "README.md")) && !existsSync(join(dir, "plugin.json")) && !existsSync(join(dir, "skills")))
    fail(`marketplace.json: plugin dir looks empty: ${p.source}`);
}

console.log(process.exitCode ? "validation failed" : "skills + marketplace valid");
