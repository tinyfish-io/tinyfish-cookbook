#!/usr/bin/env python3
"""Conformance checks for TinyFish cookbook recipes.

Each recipe relays TinyFish agent events through three hops:

    TinyFish SSE event  ->  the recipe's own /api route  ->  client hook state

Every recipe hand-rolls that relay and picks its own key names along the way,
so a rename on one hop silently strips a feature on another. The failure is
invisible: the app builds, the page loads, and the live browser preview simply
never appears. See issue #86.

This script catches that drift, plus the documentation rules CONTRIBUTING.md
already asks for. It reads only the recipes a pull request touched, so it stays
fast and never fails a PR over a file its author did not open.

Structure follows openai/openai-cookbook's .github/scripts/check_notebooks.py:
diff against the base ref, validate per file, count errors, exit non-zero.

Usage:
    python .github/scripts/check_recipes.py                 # PR-touched recipes
    python .github/scripts/check_recipes.py --all           # every recipe
    python .github/scripts/check_recipes.py --base upstream/main
    python .github/scripts/check_recipes.py tinyskills       # named recipes
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Directories at the repo root that are not recipes.
NOT_RECIPES = {
    ".git", ".github", ".claude-plugin", "graphify-out",
    "scripts", "skills", "plugins", "N8N_WorkFlows",
}

# Recipe collections: containers whose children are the actual recipes.
RECIPE_COLLECTIONS = {"AABW_Vietnam_Hackathon_Samples"}

SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs"}

SKIP_DIR_NAMES = {"node_modules", ".next", "dist", "build", "out", "coverage", ".turbo"}

# Event types the TinyFish stream itself emits, so a recipe may consume them
# without emitting them. Source: docs.tinyfish.ai/key-concepts/endpoints
# (STARTED, STREAMING_URL, PROGRESS, HEARTBEAT, COMPLETE) plus the terminal
# run statuses recipes commonly switch on.
TINYFISH_EVENT_TYPES = {
    "STARTED", "STREAMING_URL", "PROGRESS", "HEARTBEAT", "COMPLETE",
    "COMPLETED", "FAILED", "ERROR", "CANCELLED", "TIMEOUT", "RUNNING",
}

# Markers that a file talks to TinyFish directly, so its event objects are
# TinyFish's rather than the recipe's own.
SDK_MARKERS = (
    "@tiny-fish/sdk", "agent.tinyfish.ai", "run-sse",
    "from 'tinyfish", 'from "tinyfish',
)

# camelCase reads of fields the TinyFish stream publishes in snake_case.
# `receiver_required` fields also appear as ordinary domain properties, so they
# are only reported when read off a conventional stream-loop variable.
SDK_FIELDS = (
    # (wrong, right, receiver_required)
    ("streamingUrl", "streaming_url", False),
    ("resultJson", "result", False),
    ("runId", "run_id", True),
)

# Conventional names for the event object inside a TinyFish stream loop.
EVENT_RECEIVERS = {"event", "rawEvent", "evt", "ev", "streamEvent", "sseEvent", "chunk"}

# Other providers' streams also carry a `.type`, with vocabularies this script
# knows nothing about -- the Vercel AI SDK's `tool-call` / `text-delta` parts,
# for instance. A file consuming one of those is skipped for reachability
# rather than guessed at.
FOREIGN_STREAM_IMPORTS = re.compile(
    r"""from\s+["'](?:ai|openai|@ai-sdk/[\w-]+|@anthropic-ai/[\w-]+|"""
    r"""@google/generative-ai|@langchain/[\w-]+|langchain)["']"""
)

# Sections CONTRIBUTING.md requires in every recipe README.
README_REQUIREMENTS = [
    ("live link", re.compile(r"live\s*(link|demo|url|site)|https?://\S+\.(vercel\.app|app|dev|com)", re.I)),
    ("demo video or gif", re.compile(r"\.gif\b|\.mp4\b|\bdemo\s*(video|gif)\b|youtube\.com|youtu\.be|loom\.com", re.I)),
    ("TinyFish API snippet", re.compile(r"```[\s\S]*?(tinyfish|TinyFish|agent\.(run|stream))[\s\S]*?```")),
    ("how to run", re.compile(r"\b(how to run|getting started|quick ?start|installation|setup)\b", re.I)),
    ("environment variables", re.compile(r"[A-Z][A-Z0-9_]{3,}_(API_)?KEY|\.env", re.I)),
    ("architecture diagram", re.compile(r"\b(architecture|diagram|flow)\b", re.I)),
]

# type: "foo" / type: 'foo' in an object literal being built.
EMITTED_TYPE = re.compile(r"""\btype\s*:\s*["']([A-Za-z0-9_.-]+)["']""")

# Receivers whose `.type` plausibly holds a streamed event's discriminator.
# Anything else -- `source.type`, `log.type`, `field.type` -- is a domain
# property with its own vocabulary and is left alone.
EVENT_LIKE_RECEIVERS = EVENT_RECEIVERS | {
    "data", "parsed", "payload", "msg", "message", "json", "frame", "update",
}

# receiver.type === "foo", and the reversed form.
COMPARED_TYPE = re.compile(
    r"""\b(\w+)\s*\??\.\s*type\s*(?:===?|!==?)\s*["']([A-Za-z0-9_.-]+)["']"""
    r"""|["']([A-Za-z0-9_.-]+)["']\s*(?:===?|!==?)\s*\b(\w+)\s*\??\.\s*type\b"""
)

SWITCH_SUBJECT = re.compile(r"\bswitch\s*\(")
SWITCH_RECEIVER = re.compile(r"\b(\w+)\s*\??\.\s*type\b")
CASE_LABEL = re.compile(r"""\bcase\s+["']([A-Za-z0-9_.-]+)["']\s*:""")

ENV_READ = re.compile(
    r"""process\.env\.([A-Z][A-Z0-9_]*)|process\.env\[["']([A-Z][A-Z0-9_]*)["']\]"""
)

# Env vars the hosting platform injects; never expected in .env.example.
ENV_IGNORE_EXACT = {"NODE_ENV", "PORT", "CI", "NEXT_RUNTIME", "ANALYZE"}
ENV_IGNORE_PREFIXES = ("VERCEL", "GITHUB_", "NEXT_PUBLIC_VERCEL", "AWS_LAMBDA", "NETLIFY")


class Problem:
    """A single finding. `hard` failures set the exit code; warnings do not."""

    def __init__(self, location: str, message: str, hard: bool = True) -> None:
        self.location = location
        self.message = message
        self.hard = hard

    def render(self) -> str:
        tag = "error" if self.hard else "warn "
        return f"  [{tag}] {self.location}: {self.message}"


def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=False
    )
    return result.stdout if result.returncode == 0 else ""


def all_recipes() -> list[Path]:
    """Every recipe directory, flattening the hackathon-style collections."""
    found: list[Path] = []
    for entry in sorted(REPO_ROOT.iterdir()):
        if not entry.is_dir() or entry.name.startswith(".") or entry.name in NOT_RECIPES:
            continue
        if entry.name in RECIPE_COLLECTIONS:
            found.extend(
                child for child in sorted(entry.iterdir())
                if child.is_dir() and not child.name.startswith(".")
            )
        else:
            found.append(entry)
    return found


def recipe_for(path: Path) -> Path | None:
    """Map a repo-relative file path to the recipe directory that owns it."""
    parts = path.parts
    if not parts or parts[0] in NOT_RECIPES or parts[0].startswith("."):
        return None
    if parts[0] in RECIPE_COLLECTIONS:
        return REPO_ROOT / parts[0] / parts[1] if len(parts) > 1 else None
    return REPO_ROOT / parts[0]


def changed_recipes(base: str) -> tuple[list[Path], set[Path]]:
    """Recipes touched since `base`, and the exact files that changed."""
    diff = run_git("diff", "--name-only", base)
    if not diff:
        merge_base = run_git("merge-base", "HEAD", base).strip()
        if merge_base:
            diff = run_git("diff", "--name-only", merge_base)

    recipes: dict[Path, None] = {}
    files: set[Path] = set()
    for line in diff.splitlines():
        line = line.strip()
        if not line:
            continue
        rel = Path(line)
        files.add(REPO_ROOT / rel)
        owner = recipe_for(rel)
        if owner is not None and owner.is_dir():
            recipes[owner] = None
    return list(recipes), files


def source_files(recipe: Path) -> list[Path]:
    out: list[Path] = []
    for path in recipe.rglob("*"):
        if not path.is_file() or path.suffix not in SOURCE_SUFFIXES:
            continue
        if SKIP_DIR_NAMES & set(path.parts):
            continue
        out.append(path)
    return out


def show(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def strip_noise(text: str) -> str:
    """Blank out comments so they cannot fake a match.

    Block comments are replaced by their own newlines rather than removed, so
    every reported line number still matches the file on disk.
    """
    text = re.sub(r"/\*[\s\S]*?\*/", lambda m: "\n" * m.group(0).count("\n"), text)
    text = re.sub(r"(?m)//.*$", "", text)
    return text


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def balanced_subject(text: str, open_paren: int) -> str:
    """Return the text inside the parentheses starting at `open_paren`."""
    depth = 0
    for i in range(open_paren, min(len(text), open_paren + 500)):
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
            if depth == 0:
                return text[open_paren + 1:i]
    return ""


def enclosing_statement(body: str, index: int) -> str:
    """The statement containing `index`, bounded by the nearest separators.

    Used to spot a deliberate fallback chain such as
    `event.streaming_url ?? event.streamingUrl`, which spans lines but reads
    the documented field first and is therefore correct.
    """
    # Only `;` bounds a statement here. Braces are unreliable in TypeScript,
    # where an inline generic such as `Extract<E, { type: 'X' }>` sits in the
    # middle of the very expression being examined.
    start = max(body.rfind(";", 0, index), index - 400, -1)
    semicolon = body.find(";", index)
    end = min(semicolon if semicolon != -1 else len(body), index + 200)
    return body[start + 1:end]


def consumed_event_types(body: str) -> list[tuple[str, int]]:
    """Event-type literals this file compares against, with line numbers.

    `case` labels only count when the enclosing switch is on a `.type`, which
    keeps ordinary switches (CLI verbs, severity levels, icon names) out.
    """
    found: list[tuple[str, int]] = []

    for match in COMPARED_TYPE.finditer(body):
        receiver = match.group(1) or match.group(4)
        name = match.group(2) or match.group(3)
        if receiver in EVENT_LIKE_RECEIVERS:
            found.append((name, line_of(body, match.start())))

    type_switches: list[tuple[int, int]] = []
    for match in SWITCH_SUBJECT.finditer(body):
        open_paren = match.end() - 1
        subject = balanced_subject(body, open_paren)
        receiver = SWITCH_RECEIVER.search(subject)
        if receiver and receiver.group(1) in EVENT_LIKE_RECEIVERS:
            end = body.find("\n}", open_paren)
            type_switches.append((open_paren, end if end != -1 else len(body)))

    for match in CASE_LABEL.finditer(body):
        pos = match.start()
        if any(start < pos < end for start, end in type_switches):
            found.append((match.group(1), line_of(body, pos)))

    return found


def check_event_reachability(recipe: Path, files: list[Path]) -> list[Problem]:
    """Every event type a client waits on must be emitted somewhere in the recipe.

    Catches the #86 failure shape: a consumer branch that no producer can ever
    reach, so the feature behind it is dead while the app still builds.
    """
    bodies = {path: strip_noise(read(path)) for path in files}

    emitted: set[str] = set()
    for body in bodies.values():
        emitted.update(EMITTED_TYPE.findall(body))

    consumptions: list[tuple[Path, str, int]] = []
    for path, body in bodies.items():
        # A file reading another provider's stream has its own vocabulary.
        if FOREIGN_STREAM_IMPORTS.search(body):
            continue
        for name, line_no in consumed_event_types(body):
            consumptions.append((path, name, line_no))

    def quoted_count(name: str) -> int:
        return sum(
            body.count(f'"{name}"') + body.count(f"'{name}'")
            for body in bodies.values()
        )

    # Every comparison site holds one quoted copy of the literal. Any surplus
    # copy is a mention somewhere else -- a union type, an enum table, a
    # constant -- and counts as evidence the type is real and reachable.
    compared_count: dict[str, int] = {}
    for _, name, _ in consumptions:
        compared_count[name] = compared_count.get(name, 0) + 1

    problems: list[Problem] = []
    reported: set[tuple[Path, str]] = set()
    for path, name, line_no in consumptions:
        if (path, name) in reported or name in emitted or name in TINYFISH_EVENT_TYPES:
            continue
        if quoted_count(name) > compared_count[name]:
            continue
        reported.add((path, name))
        problems.append(Problem(
            f"{show(path)}:{line_no}",
            f'handles event type "{name}", which no producer in this recipe '
            f"emits and TinyFish does not send",
        ))
    return problems


def check_sdk_field_names(recipe: Path, files: list[Path]) -> list[Problem]:
    """Flag camelCase reads of TinyFish's snake_case event fields.

    Only files that talk to TinyFish directly are scanned; a recipe's own
    internal SSE payload is free to use camelCase, and most do.
    """
    problems: list[Problem] = []
    for path in files:
        raw = read(path)
        if not any(marker in raw for marker in SDK_MARKERS):
            continue
        body = strip_noise(raw)
        for wrong, right, receiver_required in SDK_FIELDS:
            if receiver_required:
                receivers = "|".join(sorted(EVENT_RECEIVERS))
                pattern = re.compile(rf"\b(?:{receivers})\s*(?:\?\.|\.)\s*{wrong}\b")
            else:
                # A read (`event.streamingUrl`), never an object key
                # (`streamingUrl: event.streaming_url`), which is correct.
                pattern = re.compile(rf"(?:\?\.|\.)\s*{wrong}\b")
            correct_read = re.compile(rf"(?:\?\.|\.)\s*{right}\b")
            for match in pattern.finditer(body):
                # A fallback chain that reads the documented field first is fine.
                if correct_read.search(enclosing_statement(body, match.start())):
                    continue
                problems.append(Problem(
                    f"{show(path)}:{line_of(body, match.start())}",
                    f"reads .{wrong} on a TinyFish event; the stream publishes "
                    f".{right}, so this is always undefined",
                ))
    return problems


def check_readme(recipe: Path, *, hard: bool) -> list[Problem]:
    """The README sections CONTRIBUTING.md requires of every project."""
    readme = next(
        (c for c in (recipe / "README.md", recipe / "readme.md", recipe / "Readme.md") if c.is_file()),
        None,
    )
    if readme is None:
        return [Problem(show(recipe), "no README.md (CONTRIBUTING.md requires one)", hard=hard)]

    body = read(readme)
    missing = [label for label, pattern in README_REQUIREMENTS if not pattern.search(body)]
    if not missing:
        return []
    return [Problem(
        show(readme),
        "missing required section(s): " + ", ".join(missing),
        hard=hard,
    )]


def check_env_documented(recipe: Path, files: list[Path]) -> list[Problem]:
    """Warn when code reads an env var no example file documents."""
    examples = [
        p for p in recipe.rglob(".env*")
        if p.is_file() and not (SKIP_DIR_NAMES & set(p.parts))
    ]
    documented = " ".join(read(p) for p in examples)
    readme_body = " ".join(read(p) for p in recipe.glob("[Rr]eadme.md"))

    used: set[str] = set()
    for path in files:
        for match in ENV_READ.finditer(strip_noise(read(path))):
            used.add(match.group(1) or match.group(2))

    undocumented = sorted(
        name for name in used
        if name not in ENV_IGNORE_EXACT
        and not name.startswith(ENV_IGNORE_PREFIXES)
        and name not in documented
        and name not in readme_body
    )
    if not undocumented:
        return []
    return [Problem(
        show(recipe),
        "env var(s) read in code but not in .env.example or README: "
        + ", ".join(undocumented),
        hard=False,
    )]


def check_recipe(recipe: Path, *, readme_hard: bool | None) -> list[Problem]:
    """`readme_hard` None skips the README check entirely."""
    files = source_files(recipe)
    problems = check_event_reachability(recipe, files)
    problems += check_sdk_field_names(recipe, files)
    if readme_hard is not None:
        problems += check_readme(recipe, hard=readme_hard)
    problems += check_env_documented(recipe, files)
    return problems


SELFTEST_CASES: list[tuple[str, dict[str, str], int]] = [
    (
        "consumed event type that nothing emits is reported",
        {
            "api/route.ts": 'send({ type: "source_start" });',
            "hooks/use.ts": 'if (event.type === "source_streaming") { show(); }',
        },
        1,
    ),
    (
        "consumed event type that a producer emits is accepted",
        {
            "api/route.ts": 'send({ type: "source_streaming" });',
            "hooks/use.ts": 'if (event.type === "source_streaming") { show(); }',
        },
        0,
    ),
    (
        "TinyFish's own event types need no local producer",
        {"hooks/use.ts": 'if (event.type === "STREAMING_URL") { show(); }'},
        0,
    ),
    (
        "switch on a non-event .type is not an event switch",
        {
            "cli/scout.mjs": (
                "switch (source.type) {\n"
                '  case "custom_discovery": return 1;\n'
                "}\n"
            )
        },
        0,
    ),
    (
        "a union type declaration counts as evidence the type is real",
        {
            "ui/log.tsx": (
                "type Log = { type: 'info' | 'browser' };\n"
                "const icon = log.type === 'browser' ? a : b;\n"
            )
        },
        0,
    ),
    (
        "another provider's stream vocabulary is left alone",
        {
            "api/agent.ts": (
                'import { streamText } from "ai";\n'
                'if (part.type === "tool-call") { track(); }\n'
            )
        },
        0,
    ),
    (
        "camelCase read of a TinyFish field is reported",
        {
            "api/route.ts": (
                'import { TinyFish } from "@tiny-fish/sdk";\n'
                "if (event.streamingUrl) { use(event.streamingUrl); }\n"
            )
        },
        2,
    ),
    (
        "re-emitting under a camelCase key is correct, not a finding",
        {
            "api/route.ts": (
                'import { TinyFish } from "@tiny-fish/sdk";\n'
                'send({ type: "STREAMING_URL", streamingUrl: event.streaming_url });\n'
            )
        },
        0,
    ),
    (
        "a fallback chain reading the documented field first is accepted",
        {
            "api/route.ts": (
                'import { TinyFish } from "@tiny-fish/sdk";\n'
                "const url = event.streaming_url ??\n"
                "    (event as Extract<E, { type: 'STREAMING_URL' }>).streamingUrl;\n"
            )
        },
        0,
    ),
    (
        "camelCase field on a non-event receiver is left alone",
        {
            "cli/scout.mjs": (
                'import { TinyFish } from "@tiny-fish/sdk";\n'
                "console.log(run.runId);\n"
            )
        },
        0,
    ),
]


def selftest() -> int:
    """Exercise the checks against synthetic recipes, guards included."""
    import tempfile

    failures = 0
    for name, files, expected in SELFTEST_CASES:
        with tempfile.TemporaryDirectory() as tmp:
            recipe = Path(tmp) / "fixture"
            for rel, content in files.items():
                target = recipe / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")

            sources = source_files(recipe)
            found = check_event_reachability(recipe, sources)
            found += check_sdk_field_names(recipe, sources)

            if len(found) == expected:
                print(f"  ok    {name}")
            else:
                failures += 1
                print(f"  FAIL  {name}: expected {expected} finding(s), got {len(found)}")
                for problem in found:
                    print(f"          {problem.message}")

    print()
    if failures:
        print(f"{failures} of {len(SELFTEST_CASES)} self-test case(s) failed.")
        return 1
    print(f"All {len(SELFTEST_CASES)} self-test case(s) passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("recipes", nargs="*", help="recipe names to check (default: PR-touched)")
    parser.add_argument("--all", action="store_true", help="check every recipe")
    parser.add_argument("--base", default="origin/main", help="base ref for the diff")
    parser.add_argument(
        "--warn-only", action="store_true", help="report findings but always exit 0"
    )
    parser.add_argument(
        "--selftest", action="store_true", help="verify the checks against synthetic recipes"
    )
    args = parser.parse_args()

    if args.selftest:
        print("Running self-test...")
        return selftest()

    touched: set[Path] = set()
    if args.recipes:
        by_name = {r.name: r for r in all_recipes()}
        targets = []
        for name in args.recipes:
            key = name.strip("/").replace("\\", "/").split("/")[-1]
            if key not in by_name:
                print(f"Unknown recipe: {name}", file=sys.stderr)
                return 2
            targets.append(by_name[key])
    elif args.all:
        targets = all_recipes()
    else:
        targets, touched = changed_recipes(args.base)
        if not targets:
            print("No recipe changes to check.")
            return 0

    # README rules are not applied retroactively. In a pull request they are a
    # hard failure only for a recipe whose README this change actually touches;
    # a full sweep reports them as warnings so existing recipes written before
    # the current template do not read as regressions.
    def readme_mode(recipe: Path) -> bool | None:
        if args.recipes or args.all:
            return False
        if any(f.parent == recipe and f.name.lower() == "readme.md" for f in touched):
            return True
        return None

    print(f"Checking {len(targets)} recipe(s)...")
    findings: list[Problem] = []
    for recipe in sorted(targets):
        problems = check_recipe(recipe, readme_hard=readme_mode(recipe))
        if problems:
            print(f"\n{recipe.name}")
            for problem in problems:
                print(problem.render())
            findings.extend(problems)

    hard = [p for p in findings if p.hard]
    warns = [p for p in findings if not p.hard]

    print()
    if not findings:
        print(f"All {len(targets)} recipe(s) passed.")
        return 0

    print(f"{len(hard)} error(s), {len(warns)} warning(s) across {len(targets)} recipe(s).")
    if hard and not args.warn_only:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
