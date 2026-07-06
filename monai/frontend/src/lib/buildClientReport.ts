import type { IntelligenceReport } from "@/components/monai/analysisExamples";

function paragraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
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
    const score = forecast.confidence_score;
    const days = forecast.projected_mainstream_days;

    return {
      headline: `${trend} — Mainstream Adoption Forecast`,
      subtitle: `Market: ${location}${score != null ? ` · Confidence ${score}/100` : ""}${days ? ` · Timeline ${days} days` : ""}`,
      paragraphs: paragraphs(reasoning),
      metrics: [
        { label: "Trend", value: trend },
        { label: "Location", value: location },
        ...(score != null ? [{ label: "Confidence", value: `${score}/100` }] : []),
        ...(days ? [{ label: "Mainstream window", value: `${days} days` }] : []),
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
      subtitle: `${trends.length} signals detected`,
      bullets: trends.map(
        (t) =>
          `${t.trend_name ?? "Trend"} (${t.growth_rate ?? "trending"}) — ${t.description ?? ""}`,
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
      subtitle: `${suppliers.length} candidates found`,
      bullets: suppliers.map(
        (s) => `${s.name} (score ${s.suitability_score ?? "—"}) — ${s.products_offered ?? ""}`,
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
