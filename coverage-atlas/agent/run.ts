#!/usr/bin/env node
// CLI for the collection agent. The web app calls the same orchestrator over
// SSE; this exists so a scan can be run, watched and re-run without a browser —
// which is how the seed data in data/ was produced.
//
//   pnpm scan "GLP-1 drugs for weight loss"
//   pnpm scan "continuous glucose monitors" --depth deep --agent-budget 10
//   pnpm scan "hepatitis C antivirals" --max-calls 120 --max-steps 60
//   pnpm scan glp1 --depth baseline          # rescan a saved condition, cheapest mode
//   pnpm agent:list
//   pnpm agent:ledger

import { ledgerSummary, scan } from "./orchestrator"
import { listConditions, listSnapshotStamps, readChanges, readRuns } from "./lib/store"

const RESET = "\x1b[0m"
const DIM = "\x1b[2m"
const BOLD = "\x1b[1m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RED = "\x1b[31m"
const BLUE = "\x1b[34m"

const STATUS_MARK: Record<string, string> = {
  covered: `${GREEN}●${RESET}`,
  conditional: `${YELLOW}●${RESET}`,
  limited: `${YELLOW}◐${RESET}`,
  not_covered: `${RED}○${RESET}`,
  unpublished: `${DIM}·${RESET}`,
}

function arg(flag: string, fallback?: string): string | undefined {
  const at = process.argv.indexOf(flag)
  return at > -1 ? process.argv[at + 1] : fallback
}

async function cmdScan(condition: string) {
  if (!process.env.TINYFISH_API_KEY) throw new Error("TINYFISH_API_KEY is not set (put it in .env.local)")
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set (put it in .env.local)")

  const depth = (arg("--depth", "standard") as "baseline" | "standard" | "deep") ?? "standard"
  console.log(`\n${BOLD}Coverage Atlas${RESET} — scanning ${BOLD}${condition}${RESET} across 51 jurisdictions ${DIM}(${depth})${RESET}\n`)

  const row: string[] = []
  const { ledger } = await scan({
    condition,
    depth,
    agentBudget: Number(arg("--agent-budget", "6")),
    waveSize: Number(arg("--wave", "5")),
    changeWindowDays: Number(arg("--change-window", "365")),
    limits: {
      maxTinyfishCalls: Number(arg("--max-calls", "200")),
      maxSteps: Number(arg("--max-steps", "80")),
      maxAgentRuns: Number(arg("--agent-budget", "6")),
    },
    onEvent: (event) => {
      switch (event.type) {
        case "phase":
          console.log(`${DIM}[${event.phase}]${RESET} ${event.note}`)
          break
        case "plan":
          console.log(
            `${BLUE}plan${RESET} ${event.fromBaseline} settled by the shared read · ${event.toFanOut} to per-state subagents\n`,
          )
          break
        case "state": {
          row.push(`${STATUS_MARK[event.record.status] ?? "?"} ${event.record.state}`)
          if (row.length === 13 || event.done === event.total) {
            console.log("  " + row.join("  "))
            row.length = 0
          }
          break
        }
        case "budget":
          if (event.tinyfishCalls > 0 && event.tinyfishCalls % 25 === 0) {
            console.log(`${DIM}[budget]${RESET} ${event.tinyfishCalls}/${event.maxTinyfishCalls} calls · ${event.steps}/${event.maxSteps} steps`)
          }
          break
        case "changes":
          console.log(
            `\n${BLUE}delta${RESET} ${event.observed} observed by snapshot diff · ` +
              `${event.historical} from dated versions found in this scan · ${event.reported} reported publicly`,
          )
          break
        case "complete": {
          console.log(`\n${BOLD}What stands out${RESET}`)
          for (const o of event.outliers) console.log(`  ${BOLD}${o.stateName}${RESET} — ${o.headline}\n    ${DIM}${o.detail}${RESET}`)
          break
        }
        case "error":
          console.error(`${RED}error${RESET} ${event.message}`)
          break
      }
    },
  })

  console.log(`\n${BOLD}Ledger${RESET}\n${ledgerSummary(ledger)}\n`)
  if (ledger.errors.length) {
    console.log(`${YELLOW}Non-fatal issues:${RESET}`)
    for (const e of ledger.errors.slice(0, 10)) console.log(`  · ${e}`)
  }
}

async function cmdList() {
  const conditions = await listConditions()
  if (conditions.length === 0) return console.log("No conditions saved yet. Run: pnpm scan \"<condition>\"")
  for (const c of conditions) {
    const stamps = await listSnapshotStamps(c.slug)
    const changes = await readChanges(c.slug)
    console.log(
      `${BOLD}${c.name}${RESET} ${DIM}(${c.slug})${RESET}\n` +
        `  ${c.treatmentClass} · ${stamps.length} snapshot${stamps.length === 1 ? "" : "s"} · ${changes.length} change events\n` +
        `  ${DIM}${c.policyLever}${RESET}`,
    )
  }
}

async function cmdLedger() {
  for (const run of await readRuns(12)) {
    console.log(`${BOLD}${run.conditionSlug}${RESET} ${DIM}${run.startedAt}${RESET}`)
    console.log(ledgerSummary(run).split("\n").map((l) => "  " + l).join("\n") + "\n")
  }
}

const [, , command, ...rest] = process.argv
const positional = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"))

async function main() {
  if (command === "scan") {
    if (!positional[0]) throw new Error('usage: scan "<condition>" [--depth baseline|standard|deep]')
    await cmdScan(positional.join(" "))
  } else if (command === "list") {
    await cmdList()
  } else if (command === "ledger") {
    await cmdLedger()
  } else {
    console.log('commands: scan "<condition>" | list | ledger')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`${RED}${err instanceof Error ? err.message : String(err)}${RESET}`)
  process.exit(1)
})
