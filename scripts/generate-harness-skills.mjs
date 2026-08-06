#!/usr/bin/env node
// Generates per-harness skill variants from skills-src/*.md.
// Claude Code output feeds the marketplace plugin; codex/hermes/openclaw
// outputs are consumed by `tinyfish connect` at install time.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "skills-src");
// Codex rejects frontmatter descriptions longer than 1024 chars.
const DESC_LIMIT = 1024;

const TARGETS = [
  { harness: "claude", dir: (name) => join(ROOT, "plugins", "tinyfish", "skills", name) },
  { harness: "codex", dir: (name) => join(ROOT, "dist", "harness-skills", "codex", name) },
  { harness: "hermes", dir: (name) => join(ROOT, "dist", "harness-skills", "hermes", name) },
  { harness: "openclaw", dir: (name) => join(ROOT, "dist", "harness-skills", "openclaw", name) },
];

function parse(src, file) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const fm = Object.fromEntries(
    m[1].split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
  );
  if (!fm.name || !fm.description) throw new Error(`${file}: frontmatter needs name + description`);
  if (fm.description.length > DESC_LIMIT)
    throw new Error(`${file}: description ${fm.description.length} chars > ${DESC_LIMIT} (Codex limit)`);
  return { fm, body: m[2] };
}

let count = 0;
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".md"))) {
  const { fm, body } = parse(readFileSync(join(SRC, file), "utf8"), file);
  for (const t of TARGETS) {
    const out = `---\nname: ${fm.name}\ndescription: ${fm.description}\n---\n${body}`;
    const dir = t.dir(fm.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), out);
    count++;
  }
}
console.log(`generated ${count} skill files`);
