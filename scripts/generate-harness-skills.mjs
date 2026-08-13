#!/usr/bin/env node
// Generates skill variants from skills-src/*.md. The claude target feeds the marketplace
// plugin; the generic target is served to every other harness by the `skills` CLI.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "skills-src");
// Codex rejects frontmatter descriptions longer than 1024 chars.
const DESC_LIMIT = 1024;

const GENERIC_REAUTH = `re-authenticate in the harness itself.

  | Harness | Re-auth |
  |---|---|
  | Codex, Hermes | no login command — auth runs on first tool use; trigger a TinyFish tool and finish the browser sign-in |
  | OpenCode | \`opencode mcp auth tinyfish\` |
  | Claude Code | \`/mcp\` in-app, or \`claude mcp login tinyfish\` |
  | OpenClaw, Cursor | key-based — \`tinyfish auth login\`, then \`tinyfish connect <harness>\` to rewrite the header |`;

const TARGETS = {
  claude: {
    dir: (name) => join(ROOT, "plugins", "tinyfish", "skills", name),
    vars: {
      HARNESS_FLAG: " --harness claude-code",
      HARNESS_ENTRY: "`--harness claude-code` narrows `harnesses[]` to exactly one entry, so there is no ambiguity about which harness it describes.",
      REAUTH: "tell the user to run `/mcp`, pick tinyfish, and sign in.",
      FEEDBACK: "offer `/tinyfish:feedback` to file it",
    },
  },
  generic: {
    dir: (name) => join(ROOT, "skills", name),
    vars: {
      HARNESS_FLAG: "",
      HARNESS_ENTRY:
        "Run without `--harness`, so `harnesses[]` carries one entry per detected harness. Read the entry whose `harness` matches the agent you are running in — never the first one.",
      REAUTH: GENERIC_REAUTH,
      FEEDBACK: "file it at https://github.com/tinyfish-io/tinyfish-cookbook/issues",
    },
  },
};

// Explicit per-target names: the `skills` CLI matches --skill on frontmatter name only,
// and feedback is Claude-specific, so neither may default to "every target".
const SKILLS = [
  { src: "doctor.md", names: { claude: "doctor", generic: "tinyfish-doctor" } },
  { src: "feedback.md", names: { claude: "feedback" } },
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

function render(body, vars, file, target) {
  const out = Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
    body
  );
  const leftover = out.match(/\{\{[A-Z_]+\}\}/);
  if (leftover) throw new Error(`${file} → ${target}: unsubstituted placeholder ${leftover[0]}`);
  return out;
}

let count = 0;
for (const skill of SKILLS) {
  const { fm, body } = parse(readFileSync(join(SRC, skill.src), "utf8"), skill.src);
  for (const [target, name] of Object.entries(skill.names)) {
    const t = TARGETS[target];
    if (!t) throw new Error(`${skill.src}: unknown target ${target}`);
    const out = `---\nname: ${name}\ndescription: ${fm.description}\n---\n${render(body, t.vars, skill.src, target)}`;
    const dir = t.dir(name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), out);
    count++;
  }
}
console.log(`generated ${count} skill files`);
