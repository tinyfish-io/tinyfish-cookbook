# Install TinyFish for your coding agent

Written for agents. If you're an AI agent reading this because a user said
"install TinyFish for me," follow the section for the harness you're running
in. If you're a human: paste "read INSTALL.md and install TinyFish for me"
into your agent, or follow the same steps yourself.

## Claude Code (no terminal needed)

In the Claude Code chat, run:

```
/plugin marketplace add tinyfish-io/tinyfish-cookbook
/plugin install tinyfish@tinyfish-marketplace
```

Agents installing on a user's behalf: the same works non-interactively —
`claude plugin marketplace add tinyfish-io/tinyfish-cookbook` then
`claude plugin install tinyfish@tinyfish-marketplace --scope user`.

**Testing a branch?** The GitHub marketplace serves the DEFAULT branch. To get
this branch's plugin version, add the marketplace from a local clone instead:
`claude plugin marketplace add ~/tinyfish-cookbook` (path to your checkout).

**Agents: how to end this install.** Two things need the human, always say so
explicitly instead of improvising:
1. OAuth — the MCP server authenticates in a browser on first tool use. Tell
   the user: "run `/mcp`, pick tinyfish, sign in."
2. Tool loading — a session started before the install won't see the TinyFish
   tools. Tell the user: "start a new session, then ask me to use TinyFish to
   find today's top Hacker News story."
Report the install as "done pending those two user steps" — never as blocked,
never as fully verified.

Success looks like: the plugin confirms installation, and TinyFish tools
(`search`, `fetch_content`, `run_web_automation`) appear. First tool use
triggers an OAuth sign-in — that's expected, complete it in the browser.

## Cursor, Codex, Hermes, OpenClaw (terminal, requires Node)

One tool:

```
npx @tiny-fish/cli connect <client>   # claude-code | codex | cursor | hermes | openclaw
```

Several tools at once:

```
npx @tiny-fish/cli connect --all
```

No `npx`? Either use the in-app path above (Claude Code), or install Node
from nodejs.org first. Non-interactive environments: set `TINYFISH_API_KEY`.

`--dry-run` shows what would be written without touching anything.
`--uninstall` removes TinyFish entries and leaves everything else intact.

## Verify / repair

After install, run one real task: "use TinyFish to find today's top Hacker
News story." If anything fails:

```
npx @tiny-fish/cli doctor --pretty     # what is wrong
npx @tiny-fish/cli doctor --fix        # repair what is repairable
```

**Agents: `--fix` is the human's command, not yours.** Without a terminal
every repair is skipped unless you pass `--yes`, and even then only
`unattended_safe` repairs run — today that is Cursor alone. Read the JSON
(`doctor` with no `--pretty`), report `checks[]` and `repairs[]`, and hand
the command to the user. Never report a skipped repair as a fix.

In-agent, `/tinyfish:doctor` runs the same checks and additionally proves
this harness can reach TinyFish — the one thing the CLI cannot verify, since
it cannot borrow the harness's OAuth token. A `registration: pass` from the
CLI means the config exists, not that a call would succeed.

## No agent at all?

Use the playground: https://agent.tinyfish.ai — no install required.

<!-- Hand-maintained (spec owner). Not generator-emitted. Keep in sync with
docs/specs/2026-08-05-tinyfish-setup-skills-design.md. -->
