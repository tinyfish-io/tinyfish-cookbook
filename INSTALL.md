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
News story." If anything fails, run the `/tinyfish:doctor` skill in your
agent — it diagnoses MCP config, auth, and connectivity, and knows how to
repair by re-running connect.

## No agent at all?

Use the playground: https://agent.tinyfish.ai — no install required.

<!-- Hand-maintained (spec owner). Not generator-emitted. Keep in sync with
docs/specs/2026-08-05-tinyfish-setup-skills-design.md. -->
