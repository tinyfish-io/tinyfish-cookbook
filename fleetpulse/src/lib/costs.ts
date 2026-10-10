import { TinyFish, RunStatus, BrowserProfile } from "@tiny-fish/sdk";
import type { Run } from "@tiny-fish/sdk";
import type { CostSource, CostSnapshot, AgentStatus, Vehicle } from "./types";
import { getVietnamDateString } from "./date";
import { estimateFallbackValue, summarizeRawResult } from "./estimate";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 150;
const REAL_BROWSER_PROFILE = BrowserProfile.STEALTH;

let _client: TinyFish | null = null;
let _loggedKeyStatus = false;
function getClient(): TinyFish | null {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!_loggedKeyStatus) {
    _loggedKeyStatus = true;
    if (apiKey) {
      console.log(`[TinyFish] API key detected (${apiKey.slice(0, 4)}...${apiKey.slice(-4)}) — using real agents.`);
    } else {
      console.warn("[TinyFish] No TINYFISH_API_KEY found — sweep will return no real data this run.");
    }
  }
  if (!apiKey) return null;
  if (!_client) _client = new TinyFish({ apiKey, timeout: 60_000, maxRetries: 2 });
  return _client;
}

const FUEL_LABEL: Record<Vehicle["fuelType"], string> = {
  petrol: "RON95 gasoline",
  diesel: "0.05S diesel (DO)",
  electric: "EV fast-charging (per kWh, converted to an equivalent per-liter comparison if needed)",
};
const TOLL_CLASS_LABEL: Record<Vehicle["vehicleClass"], string> = {
  car: "Class 1 (standard passenger car, under 12 seats / under 2 tons)",
  truck: "Class 2 (trucks/vans between 2 and 4 tons, or the closest matching class)",
};

function buildGoal(source: CostSource, vehicle: Vehicle): string {
  const todayStr = getVietnamDateString();
  const task =
    source.kind === "fuel"
      ? `Find the current retail price for ${FUEL_LABEL[vehicle.fuelType]}, per liter, in Vietnamese dong.`
      : source.kind === "toll"
        ? `Find the toll fee for ${TOLL_CLASS_LABEL[vehicle.vehicleClass]} vehicles on the Hanoi – Hai Phong Expressway (CT04), in Vietnamese dong.`
        : `Estimate the fare for a one-way ${vehicle.vehicleClass === "truck" ? "GrabExpress delivery" : "GrabCar ride"} from Noi Bai International Airport to Hanoi Old Quarter, in Vietnamese dong. You may need to enter these as pickup/dropoff locations to see a fare estimate.`;

  return [
    `Today's date is ${todayStr} (Vietnam local time, UTC+7).`,
    `This check is for a ${vehicle.name} (${vehicle.fuelType}, ${vehicle.vehicleClass}).`,
    "You are checking a public price only. Do not create an account, log in, or book/pay for anything.",
    "Work as quickly and efficiently as possible. Take the minimum number of steps needed.",
    "1. If a cookie banner or popup appears, dismiss it first.",
    `2. ${task}`,
    "3. Try this once. If you find a clear value, record it and stop — do not double-check or re-verify. If it doesn't work on the first attempt, try one more time (2 attempts total), then give up if it still doesn't work.",
    "4. If you genuinely cannot find a value, return no result rather than guessing or estimating.",
    "",
    'Prefer returning JSON in this exact structure: {"valueVnd": 20500} — a plain integer in VND, no currency symbol, no commas, no decimals.',
    "If the page instead shows a detailed fare/price breakdown (e.g. a base fare plus separate per-km segments, or itemized fees) rather than one clean total, it's fine to return that full breakdown as you found it instead — include whatever fields are shown (base fare, per-segment amounts, distances, total) so the real total can be worked out from it afterward. Only omit the result entirely if you found nothing at all.",
  ].join(" ");
}

function extractResult(result: Run["result"], label: string): { value: number | null; raw: unknown } {
  if (!result) {
    console.log(`[costs] ${label}: run.result was empty/undefined`);
    return { value: null, raw: null };
  }
  if ((result as any).status === "failure" || (result as any).error) {
    console.log(`[costs] ${label}: agent reported goal failure — ${(result as any).error ?? "no message"}`);
    return { value: null, raw: null };
  }
  const value = (result as any).valueVnd;
  if (typeof value === "number" && value > 0) {
    return { value, raw: result };
  }
  // No clean valueVnd, but the agent may still have returned a real
  // detailed breakdown (e.g. Grab's base fare + per-km segments) instead
  // of one number — that's still real, scraped data, just not in our
  // exact expected shape. Hand it to summarizeRawResult() rather than
  // throwing it away.
  console.log(`[costs] ${label}: no direct valueVnd — checking for a raw breakdown to summarize. Raw result:`, JSON.stringify(result).slice(0, 500));
  return { value: null, raw: result };
}

async function pollUntilDone(client: TinyFish, runId: string, label: string): Promise<Run | null> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    let run;
    try {
      run = await client.runs.get(runId);
    } catch (err) {
      console.error(`[costs] ${label}: poll #${attempt + 1} threw a connection error, retrying:`, err);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }
    if (attempt < 5 || attempt % 6 === 0) {
      console.log(`[costs] ${label}: poll #${attempt + 1} → status=${run.status}`);
    }
    if (run.status === RunStatus.COMPLETED || run.status === RunStatus.FAILED || run.status === RunStatus.CANCELLED) {
      return run;
    }
    if (run.result && Object.keys(run.result as object).length > 0) {
      console.log(`[costs] ${label}: result payload present despite status=${run.status} — treating as complete`);
      return run;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.error(`[costs] ${label}: gave up after ${MAX_POLL_ATTEMPTS} polls — status never reached a terminal value and no result payload appeared`);
  return null;
}

async function scrapeSourceForVehicle(source: CostSource, vehicle: Vehicle): Promise<{ value: number | null; wasSummarized: boolean }> {
  const label = `${source.name} (${vehicle.name})`;
  console.log(`[costs] ${label}: worker started`);
  const client = getClient();
  if (!client) {
    console.log(`[costs] ${label}: no client (no API key) — skipping`);
    return { value: null, wasSummarized: false };
  }
  try {
    console.log(`[costs] ${label}: calling client.agent.queue...`);
    const queued = await client.agent.queue({ url: source.url, goal: buildGoal(source, vehicle), browser_profile: REAL_BROWSER_PROFILE });
    console.log(`[costs] ${label}: queue() returned, run_id=${queued.run_id ?? "none"}`);
    if (queued.error || !queued.run_id) {
      console.error(`TinyFish queue failed for ${source.id}/${vehicle.id}:`, queued.error?.message);
      return { value: null, wasSummarized: false };
    }
    const run = await pollUntilDone(client, queued.run_id, label);
    if (!run) {
      console.error(`TinyFish run timed out for ${source.id}/${vehicle.id}`);
      return { value: null, wasSummarized: false };
    }
    const hasResultPayload = Boolean(run.result && Object.keys(run.result as object).length > 0);
    if (run.status !== RunStatus.COMPLETED && !hasResultPayload) {
      console.error(`TinyFish run ${run.status} for ${source.id}/${vehicle.id}: [${run.error?.category}] ${run.error?.message}`);
      return { value: null, wasSummarized: false };
    }
    const { value, raw } = extractResult(run.result, label);
    if (value !== null) return { value, wasSummarized: false };

    if (raw && Object.keys(raw as object).length > 0) {
      const summarized = await summarizeRawResult(raw, source, vehicle);
      if (summarized !== null) {
        console.log(`[costs] ${label}: Groq summarized the raw breakdown into ${summarized} VND`);
        return { value: summarized, wasSummarized: true };
      }
    }
    return { value: null, wasSummarized: false };
  } catch (err) {
    console.error(`TinyFish error for ${source.id}/${vehicle.id}:`, err);
    return { value: null, wasSummarized: false };
  }
}

function labelFor(source: CostSource, vehicle: Vehicle): string {
  if (source.kind === "fuel") return `${FUEL_LABEL[vehicle.fuelType]} per liter`;
  if (source.kind === "toll") return "Hanoi–Hai Phong toll";
  return vehicle.vehicleClass === "truck" ? "GrabExpress estimate, Noi Bai → Old Quarter" : "GrabCar estimate, Noi Bai → Old Quarter";
}

// Sweeps all 3 sources for ONE vehicle in parallel, calling onSourceDone
// the instant each finishes — progressive, same pattern as every other
// app in this family.
export async function runCostSweepForVehicle(
  sources: CostSource[],
  vehicle: Vehicle,
  onSourceDone: (source: CostSource, snapshot: CostSnapshot, status: AgentStatus) => void | Promise<void>
): Promise<void> {
  const usingRealAgents = Boolean(process.env.TINYFISH_API_KEY);
  console.log(`[costs] sweep starting for vehicle ${vehicle.name}, ${sources.length} sources, realAgents=${usingRealAgents}`);

  await Promise.all(
    sources.map(async (source) => {
      const { value, wasSummarized } = await scrapeSourceForVehicle(source, vehicle);
      const status: AgentStatus = {
        vehicleId: vehicle.id,
        sourceId: source.id,
        status: value !== null ? "done" : usingRealAgents ? "error" : "done",
        lastSyncedAt: new Date().toISOString(),
      };

      let snapshot: CostSnapshot;
      if (value !== null) {
        // Still "real" even when wasSummarized — Groq only computed the
        // total from numbers the agent actually found on the real page,
        // it didn't invent anything. Worth noting in the label so it's
        // clear this wasn't a single clean number straight off the page.
        snapshot = {
          vehicleId: vehicle.id,
          sourceId: source.id,
          label: labelFor(source, vehicle) + (wasSummarized ? " (from detailed breakdown)" : ""),
          valueVnd: value,
          checkedAt: new Date().toISOString(),
          source: "real",
        };
      } else {
        // The real agent couldn't find it (or there's no key at all) — rather
        // than leave this card blank forever, fall back to a Groq estimate
        // (or a hardcoded ballpark if Groq isn't configured either), always
        // clearly marked "estimated" so it's never mistaken for live data.
        const fallbackValue = await estimateFallbackValue(source, vehicle);
        console.log(`[costs] ${source.name} (${vehicle.name}): using fallback estimate (${fallbackValue} VND)`);
        snapshot = { vehicleId: vehicle.id, sourceId: source.id, label: labelFor(source, vehicle), valueVnd: fallbackValue, checkedAt: new Date().toISOString(), source: "estimated" };
      }

      try {
        await onSourceDone(source, snapshot, status);
      } catch (err) {
        console.error(`[costs] onSourceDone callback failed for ${source.id}/${vehicle.id} (sweep continues regardless):`, err);
      }
    })
  );
}
