import type { IntelligenceReport } from "@/components/monai/analysisExamples";

function paragraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function rankLabel(item: Record<string, unknown>): string {
  const rank = item.display_rank ?? item.search_rank;
  return rank != null ? `#${rank}` : "—";
}

export function buildClientReport(data: unknown): IntelligenceReport | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;

  if (record.report && typeof record.report === "object") {
    return record.report as IntelligenceReport;
  }

  if (record.forecast && typeof record.forecast === "object") {
    const forecast = record.forecast as Record<string, unknown>;
    const trend = String(record.trend ?? forecast.trend ?? "Trend");
    const location = String(record.location ?? forecast.location ?? "Market");
    const reasoning = String(forecast.reasoning ?? forecast.summary ?? "");
    const signalCount = forecast.signal_count;
    const evidence =
      signalCount != null ? `${signalCount} TinyFish signals` : "";

    return {
      headline: `${trend} — Adoption Signal Summary`,
      subtitle: `Market: ${location}${evidence ? ` · ${evidence}` : ""}`,
      paragraphs: paragraphs(reasoning),
      metrics: [
        { label: "Trend", value: trend },
        { label: "Location", value: location },
        ...(evidence ? [{ label: "Signals", value: evidence }] : []),
      ],
      ready_to_use: reasoning
        ? [
            {
              label: "Executive summary",
              text: reasoning,
            },
          ]
        : [],
    };
  }

  if (record.emerging_trends && Array.isArray(record.emerging_trends)) {
    const trends = record.emerging_trends as Array<Record<string, unknown>>;
    const location = String(record.location ?? "Market");
    return {
      headline: `Emerging F&B Trends — ${location}`,
      subtitle: `${trends.length} signals from live search`,
      bullets: trends.map(
        (t) =>
          `${t.trend_name ?? "Trend"}${rankLabel(t) !== "—" ? ` (${rankLabel(t)})` : ""} — ${t.description ?? ""}`,
      ),
    };
  }

  if (record.menu_gap_analysis && typeof record.menu_gap_analysis === "object") {
    const analysis = record.menu_gap_analysis as Record<string, unknown>;
    const missing = (analysis.missing_opportunities as Array<Record<string, unknown>>) ?? [];
    return {
      headline: "Menu Gap Analysis",
      subtitle: `Location: ${String(analysis.location ?? "—")}`,
      bullets: missing.map(
        (item) => `${item.trend}: ${item.recommendation ?? item.evidence ?? ""}`,
      ),
    };
  }

  if (record.comparison && typeof record.comparison === "object") {
    const comparison = record.comparison as Record<string, unknown>;
    return {
      headline: `Regional Comparison — ${comparison.region_a ?? "A"} vs ${comparison.region_b ?? "B"}`,
      subtitle: `Category: ${comparison.category ?? "F&B"}`,
      paragraphs: paragraphs(String(comparison.summary ?? "")),
    };
  }

  if (record.suppliers && Array.isArray(record.suppliers)) {
    const suppliers = record.suppliers as Array<Record<string, unknown>>;
    return {
      headline: `Supplier Shortlist — ${record.trend ?? "Trend"}`,
      subtitle: `${suppliers.length} candidates from live search`,
      bullets: suppliers.map(
        (s) =>
          `${s.name}${s.search_rank != null ? ` (rank #${s.search_rank})` : ""} — ${s.products_offered ?? ""}`,
      ),
    };
  }

  if (record.rfq_template && typeof record.rfq_template === "object") {
    const rfq = record.rfq_template as Record<string, unknown>;
    return {
      headline: "RFQ & Supplier Outreach",
      subtitle: "Bilingual templates",
      ready_to_use: [
        {
          label: "Email — English",
          text: `Subject: ${rfq.subject_en ?? ""}\n\n${rfq.body_en ?? ""}`,
        },
        {
          label: "Email — Tiếng Việt",
          text: `Subject: ${rfq.subject_vi ?? ""}\n\n${rfq.body_vi ?? ""}`,
        },
      ],
    };
  }

  return null;
}
