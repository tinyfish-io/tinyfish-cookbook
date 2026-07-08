export type AnalysisCategory =
  | "menu-gap"
  | "forecast"
  | "regional"
  | "suppliers"
  | "outreach";

export type ReportSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type ReportCard = {
  title: string;
  subtitle?: string;
  body: string;
  tag?: string;
};

export type ReportSource = {
  title: string;
  excerpt?: string;
  url?: string;
};

export type IntelligenceReport = {
  headline: string;
  subtitle?: string;
  paragraphs?: string[];
  metrics?: { label: string; value: string }[];
  sections?: ReportSection[];
  bullets?: string[];
  sources?: ReportSource[];
  actions?: string[];
  cards?: ReportCard[];
  ready_to_use?: { label: string; text: string }[];
};

export type ExampleHint = {
  title: string;
  description: string;
  sampleOutput: IntelligenceReport;
};

/** Layout-only preview — no fabricated counts, ranks, or supplier names. */
const PREVIEW_SHELL: IntelligenceReport = {
  headline: "Intelligence report",
  subtitle: "Populated from live TinyFish search after you run an analysis",
  paragraphs: [
    "Metrics, ranks, and supplier names are taken only from API responses — never hardcoded in the UI.",
    "Run the analysis above to replace this preview with real signals for your market and inputs.",
  ],
  sections: [
    {
      title: "What you will see",
      bullets: [
        "Source titles and excerpts from TinyFish search",
        "Search ranks when returned by the search API",
        "Signal counts derived from the number of results returned",
      ],
    },
  ],
};

export const ANALYSIS_EXAMPLES: Record<AnalysisCategory, ExampleHint> = {
  "menu-gap": {
    title: "Menu Gap Analysis",
    description:
      "Benchmark your menu against live trend signals and competitor pages — prioritized gaps with chef-ready briefings.",
    sampleOutput: {
      ...PREVIEW_SHELL,
      headline: "Menu Gap Analysis",
    },
  },
  forecast: {
    title: "Trend Forecast",
    description:
      "Summarize adoption signals from live web search — reasoning and drivers sourced from TinyFish results.",
    sampleOutput: {
      ...PREVIEW_SHELL,
      headline: "Trend Forecast",
    },
  },
  regional: {
    title: "Regional Comparison",
    description:
      "Compare top search signals between two Vietnamese markets using live TinyFish data per region.",
    sampleOutput: {
      ...PREVIEW_SHELL,
      headline: "Regional Comparison",
    },
  },
  suppliers: {
    title: "Supplier Discovery",
    description:
      "Supplier shortlist ranked by TinyFish search position — contact info and snippets from live results.",
    sampleOutput: {
      ...PREVIEW_SHELL,
      headline: "Supplier Discovery",
    },
  },
  outreach: {
    title: "RFQ Outreach",
    description:
      "Bilingual RFQ drafts built from your product needs and supplier details — personalize before sending.",
    sampleOutput: {
      ...PREVIEW_SHELL,
      headline: "RFQ Outreach",
    },
  },
};

export function extractReport(data: unknown): IntelligenceReport | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record.report && typeof record.report === "object") {
    return record.report as IntelligenceReport;
  }
  return null;
}
