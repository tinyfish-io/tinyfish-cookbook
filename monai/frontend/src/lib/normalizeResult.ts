import { extractReport, type IntelligenceReport } from "@/components/monai/analysisExamples";

const MAX_NORMALIZE_DEPTH = 32;

function tryParseJsonString(text: string): unknown | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  const payload = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function normalizeResult(data: unknown, depth = 0): unknown {
  if (depth > MAX_NORMALIZE_DEPTH) {
    return data;
  }

  if (typeof data === "string") {
    const stripped = data.trim();
    if (stripped.startsWith("{") || stripped.startsWith("[") || stripped.startsWith("```")) {
      const parsed = tryParseJsonString(stripped);
      if (parsed !== null) {
        return normalizeResult(parsed, depth + 1);
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => normalizeResult(item, depth + 1));
  }

  if (data && typeof data === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      next[key] = normalizeResult(value, depth + 1);
    }
    return next;
  }

  return data;
}

export function resolveReport(data: unknown): IntelligenceReport | null {
  const normalized = normalizeResult(data);
  return extractReport(normalized);
}

export function hasReport(data: unknown): boolean {
  return resolveReport(data) !== null;
}
