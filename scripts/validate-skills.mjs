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

// The generator writes into the tree, so a dirty tree must stop it: overwriting an
// uncommitted edit is not something a validator may do.
const status = () => execSync("git status --porcelain -- plugins skills", { cwd: ROOT }).toString().trim();
const dirty = status();
if (dirty) {
  fail(`uncommitted changes under plugins/ or skills/ — commit or stash before validating, the generator overwrites them:\n${dirty}`);
  console.log("validation failed");
  process.exit(1);
}
execSync(`node ${join(ROOT, "scripts", "generate-harness-skills.mjs")}`, { stdio: "pipe" });
const drift = status();
if (drift) fail(`generated skills out of sync with skills-src — run scripts/generate-harness-skills.mjs and commit:\n${drift}`);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name === "SKILL.md" ? [join(dir, e.name)] : []
  );
// Every skill under skills/ is served by the `skills` CLI, so all of them face the Codex limit.
for (const f of [...walk(join(ROOT, "plugins")), ...walk(join(ROOT, "skills"))]) {
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
  if (!existsSync(join(dir, "README.md")) && !existsSync(join(dir, ".claude-plugin", "plugin.json")) && !existsSync(join(dir, "skills")))
    fail(`marketplace.json: plugin dir looks empty: ${p.source}`);
  // plugin.json wins at install time, so a one-sided bump silently ships the wrong version.
  const manifest = join(dir, ".claude-plugin", "plugin.json");
  if (existsSync(manifest)) {
    const declared = JSON.parse(readFileSync(manifest, "utf8")).version;
    if (p.version !== declared)
      fail(`marketplace.json: ${p.name} entry says ${p.version} but plugin.json says ${declared} (plugin.json wins at install)`);
  }
}

// Catches version skew between the entry and plugin.json, where plugin.json silently wins.
// Kept alongside the checks above: --strict never verifies that `source` resolves (#241).
const hasClaude = (() => {
  try {
    execSync("command -v claude", { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
})();
if (hasClaude) {
  try {
    execSync("claude plugin validate . --strict", { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    const out = [e.stdout?.toString(), e.stderr?.toString()].filter(Boolean).join("\n").trim();
    fail(`claude plugin validate --strict:\n${out}`);
  }
} else {
  console.log("skipped: claude plugin validate --strict (claude CLI not on PATH)");
}

console.log(process.exitCode ? "validation failed" : "skills + marketplace valid");
