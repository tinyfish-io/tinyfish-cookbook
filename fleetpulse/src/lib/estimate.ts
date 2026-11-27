import type { CostSource, Vehicle } from "./types";

// Reasonable ballpark VND figures, used only if both the real agent AND
// Groq are unavailable. These are rough, openly-labeled estimates — never
// presented as real, current, scraped data.
const HARDCODED_FALLBACK: Record<string, Record<Vehicle["vehicleClass"], number>> = {
  petrolimex: { car: 20500, truck: 19200 }, // petrol vs diesel per liter, roughly
  vetc: { car: 160000, truck: 260000 }, // Hanoi–Hai Phong toll, Class 1 vs Class 2
  grab: { car: 350000, truck: 280000 }, // Noi Bai → Old Quarter, GrabCar vs GrabExpress
};

function hardcodedFallback(source: CostSource, vehicle: Vehicle): number {
  return HARDCODED_FALLBACK[source.id]?.[vehicle.vehicleClass] ?? 200000;
}

// Used when the real agent found NOTHING at all — a pure invented
// estimate, always saved with source: "estimated", never mistaken for
// live data.
export async function estimateFallbackValue(source: CostSource, vehicle: Vehicle): Promise<number> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return hardcodedFallback(source, vehicle);

  const question =
    source.kind === "fuel"
      ? `the current typical retail price in Vietnam for ${vehicle.fuelType === "diesel" ? "diesel (DO)" : vehicle.fuelType === "electric" ? "EV charging, converted to an equivalent per-liter comparison" : "RON95 gasoline"}, per liter, in VND`
      : source.kind === "toll"
        ? `the typical toll fee on the Hanoi–Hai Phong Expressway for a ${vehicle.vehicleClass === "truck" ? "truck/van (Class 2)" : "car (Class 1)"}, in VND`
        : `the typical ${vehicle.vehicleClass === "truck" ? "GrabExpress delivery" : "GrabCar ride"} fare from Noi Bai Airport to Hanoi Old Quarter, in VND`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You give a single best-guess numeric estimate based on general knowledge, when live data isn't available. Respond with ONLY a raw JSON object: {\"valueVnd\": 20500} — a plain integer, your best reasonable estimate, no explanation.",
          },
          { role: "user", content: `Estimate ${question}.` },
        ],
        temperature: 0.3,
        max_tokens: 50,
      }),
    });
    if (!res.ok) return hardcodedFallback(source, vehicle);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return typeof parsed?.valueVnd === "number" && parsed.valueVnd > 0 ? Math.round(parsed.valueVnd) : hardcodedFallback(source, vehicle);
  } catch {
    return hardcodedFallback(source, vehicle);
  }
}

// Used when the real agent DID find something — just not in our exact
// {"valueVnd": N} shape, e.g. Grab returning a full fare breakdown (base
// fare + per-km segments + total) instead of one clean number. This is
// still genuinely scraped, real data — Groq's job here is purely to read
// the actual numbers already found and compute/identify the final total,
// not to invent anything. Returns null (not a guess) if it can't make
// sense of the raw data either, so the caller falls through to the
// clearly-labeled "estimated" tier instead.
export async function summarizeRawResult(raw: unknown, source: CostSource, vehicle: Vehicle): Promise<number | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: [
              "You will receive raw JSON scraped from a real webpage — a price or fare breakdown, not in a clean single-number format.",
              "Read the actual numbers given and compute or identify the single final total cost in Vietnamese dong. Do not invent or estimate anything not derivable from the data given.",
              "If the data doesn't actually contain enough to compute a real total, say so by returning null rather than guessing.",
              'Respond with ONLY a raw JSON object: {"valueVnd": 468327} or {"valueVnd": null} if it can\'t genuinely be computed from what\'s given.',
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              context: `${source.kind} cost for a ${vehicle.vehicleClass} (${vehicle.fuelType})`,
              rawData: raw,
            }),
          },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return typeof parsed?.valueVnd === "number" && parsed.valueVnd > 0 ? Math.round(parsed.valueVnd) : null;
  } catch {
    return null;
  }
}
