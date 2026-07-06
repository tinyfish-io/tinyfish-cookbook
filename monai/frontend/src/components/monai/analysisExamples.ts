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

const forecastSample: IntelligenceReport = {
  headline: "Matcha Coconut Coffee — Mainstream Adoption Forecast",
  subtitle: "Market: TP.HCM · Confidence 85/100 · Timeline 30-60 days",
  paragraphs: [
    "Highlands Coffee and specialty matcha bars are integrating coconut-matcha formats into core menus — a strong operator signal that the trend is moving beyond novelty.",
    "Social platforms (TikTok, Instagram) show sustained UGC volume from Gen Z consumers in TP.HCM, indicating repeat purchase behavior rather than one-time trial.",
    "Mainstream adoption is likely within **30–60 days** if major chains maintain promotional weight through Q3. Validate with your own POS data before national rollout.",
  ],
  metrics: [
    { label: "Trend", value: "Matcha Coconut Coffee" },
    { label: "Location", value: "TP.HCM" },
    { label: "Confidence", value: "85/100" },
    { label: "Mainstream window", value: "30-60 days" },
  ],
  sections: [
    {
      title: "Key adoption drivers",
      bullets: [
        "Major coffee chains adding matcha-coconut SKUs",
        "High UGC volume on TikTok and Instagram Reels",
        "Delivery app featuring as seasonal bestseller",
      ],
    },
  ],
  actions: [
    "Brief R&D and procurement within 48 hours.",
    "Run a 2-week LTO in 3 high-traffic stores.",
    "Secure hero ingredients before competitor menu saturation.",
  ],
  ready_to_use: [
    {
      label: "Internal product memo",
      text:
        "Subject: Matcha Coconut Coffee adoption outlook — TP.HCM\n\n" +
        "Team,\n\nOur intelligence scan estimates mainstream adoption within 30-60 days (confidence 85/100).\n\n" +
        "Recommended action: Brief R&D and procurement this week; run a 2-week LTO pilot.\n\n— Product Strategy",
    },
    {
      label: "Leadership Slack update",
      text:
        "*Matcha Coconut Coffee* is accelerating in *TP.HCM*. Forecast: mainstream in ~30-60 days. Suggest fast-track tasting + supplier quotes.",
    },
  ],
};

export const ANALYSIS_EXAMPLES: Record<AnalysisCategory, ExampleHint> = {
  "menu-gap": {
    title: "Menu Gap Analysis",
    description:
      "Benchmark your menu against live trend signals and competitor moves — get prioritized gaps with chef-ready briefings.",
    sampleOutput: {
      headline: "Menu Gap Analysis",
      subtitle: "Location: Hà Nội · 2 opportunities · 3 items reviewed",
      paragraphs: [
        "Your **3-item menu** was benchmarked against live trend signals in *Hà Nội*.",
        "We identified **2 actionable gaps** where demand is outpacing your current assortment.",
        "Focus on **High** priority items first — they have the strongest operator and social proof.",
      ],
      metrics: [
        { label: "Menu items reviewed", value: "3" },
        { label: "Gap opportunities", value: "2" },
        { label: "High priority", value: "1" },
        { label: "Market", value: "Hà Nội" },
      ],
      cards: [
        {
          title: "Matcha Coconut Latte",
          subtitle: "High priority",
          body: "Run a 14-day LTO in Hà Nội. Target 8–12% attach rate before core menu add.",
          tag: "Hà Nội",
        },
        {
          title: "Salt Coffee (Cà phê muối)",
          subtitle: "Medium priority",
          body: "Test as premium upsell — strong Da Nang-origin trend expanding north.",
          tag: "Hà Nội",
        },
      ],
      actions: [
        "Pick Matcha Coconut Latte for a 14-day LTO.",
        "Train baristas on prep SOP before launch.",
        "Compare pilot attach rate vs. bestsellers.",
      ],
      ready_to_use: [
        {
          label: "Chef & R&D briefing",
          text:
            "Chef brief — menu gap review (Hà Nội)\n\nCurrent core:\n• Cà phê sữa đá\n• Bạc xỉu\n• Trà đào\n\n" +
            "Priority additions:\n• [High] Matcha Coconut Latte — 14-day pilot\n• [Medium] Salt Coffee — premium upsell test",
        },
      ],
    },
  },
  forecast: {
    title: "Trend Forecast",
    description:
      "Estimate when a trend moves from early adopters to mainstream — with confidence scores, drivers, and leadership-ready memos.",
    sampleOutput: forecastSample,
  },
  regional: {
    title: "Regional Comparison",
    description:
      "Side-by-side market intelligence for two Vietnamese cities — localized LTO strategy and expansion briefs included.",
    sampleOutput: {
      headline: "Regional Comparison — Hà Nội vs TP.HCM",
      subtitle: "Category: beverage · Lead trends: Salt Coffee / Matcha Coconut Coffee",
      paragraphs: [
        "*Hà Nội* leads with **Salt Coffee** while *TP.HCM* shows strongest pull toward **Matcha Coconut Coffee**.",
        "National brands should keep a stable core menu but localize hero LTOs per city cluster.",
      ],
      metrics: [
        { label: "Region A", value: "Hà Nội" },
        { label: "Region B", value: "TP.HCM" },
        { label: "Category", value: "beverage" },
        { label: "A lead trend", value: "Salt Coffee" },
        { label: "B lead trend", value: "Matcha Coconut Coffee" },
      ],
      sections: [
        {
          title: "Hà Nội — local signals",
          bullets: ["Salt Coffee premium formats", "Traditional phin coffee base", "Tea-based seasonal LTOs"],
        },
        {
          title: "TP.HCM — local signals",
          bullets: ["Matcha-coconut fusion drinks", "Fruit-forward cold brew", "Social-media driven LTOs"],
        },
      ],
      bullets: [
        "Launch Matcha-inspired LTO in Hà Nội if local social volume supports it.",
        "Test Salt Coffee format in TP.HCM flagship stores first.",
        "Align pricing to local portion-size expectations.",
      ],
      actions: [
        "Maintain core menu nationally; localize 2–3 hero items per region.",
        "Run A/B pricing tests by city cluster.",
      ],
      ready_to_use: [
        {
          label: "Expansion strategy brief",
          text:
            "Subject: Regional menu strategy — Hà Nội vs TP.HCM\n\n" +
            "Hà Nội lead: Salt Coffee · TP.HCM lead: Matcha Coconut Coffee\n\n" +
            "Action: Keep national core stable; deploy localized hero LTOs per region.",
        },
      ],
    },
  },
  suppliers: {
    title: "Supplier Discovery",
    description:
      "Ranked wholesale supplier shortlist with suitability scores, tier labels, and procurement-ready outreach.",
    sampleOutput: {
      headline: "Supplier Shortlist — Matcha Coconut Coffee",
      subtitle: "5 candidates ranked · Top pick: Saigon Matcha Co.",
      paragraphs: [
        "Sourcing intelligence surfaced **5 supplier candidates** from live wholesale search results.",
        "Contact the top two **Preferred** options in parallel to compare MOQ and delivered pricing.",
      ],
      metrics: [
        { label: "Trend", value: "Matcha Coconut Coffee" },
        { label: "Suppliers found", value: "5" },
        { label: "Top pick", value: "Saigon Matcha Co." },
        { label: "Top score", value: "10/10" },
      ],
      cards: [
        {
          title: "Saigon Matcha Co.",
          subtitle: "Score 10/10 · Preferred",
          body: "Ceremonial and culinary grade matcha — TP.HCM warehouse, foodservice MOQ from 50kg.",
          tag: "Matcha Coconut Coffee",
        },
        {
          title: "Mekong Coconut Supply",
          subtitle: "Score 9/10 · Strong fit",
          body: "UHT coconut cream, bulk foodservice packs — weekly delivery to southern Vietnam.",
          tag: "Matcha Coconut Coffee",
        },
      ],
      actions: [
        "Email top 2 suppliers using the RFQ tab.",
        "Request samples before bulk MOQ commitment.",
      ],
      ready_to_use: [
        {
          label: "Procurement outreach (short)",
          text:
            "Hello,\n\nWe are launching a Matcha Coconut Coffee line and reviewing bulk ingredient suppliers.\n\n" +
            "Could you share MOQ, tiered pricing, and sample lead time?\n\nBest regards",
        },
      ],
    },
  },
  outreach: {
    title: "RFQ Outreach",
    description:
      "Bilingual, send-ready supplier emails with structured asks — MOQ, pricing tiers, samples, and delivery terms.",
    sampleOutput: {
      headline: "RFQ & Supplier Outreach",
      subtitle: "Bilingual templates · Personalize quantities before sending",
      paragraphs: [
        "Templates formatted for **immediate supplier outreach**. Replace quantities with your actual MOQ targets.",
        "Follow up in **3 business days** if pricing tiers are not received.",
      ],
      sections: [
        {
          title: "What to ask for",
          bullets: [
            "Bulk pricing tiers (FOB and delivered)",
            "MOQ and reorder lead time",
            "Sample policy and certification",
            "Payment terms and monthly capacity",
          ],
        },
      ],
      actions: [
        "Send RFQ to top 2 shortlisted suppliers.",
        "Log responses in procurement tracker.",
      ],
      ready_to_use: [
        {
          label: "Email — English",
          text:
            "Subject: RFQ — Ceremonial matcha (Bulk Supply Inquiry)\n\nDear Supplier Partner,\n\n" +
            "We are sourcing: 500kg ceremonial matcha, monthly delivery.\n\n" +
            "Please share MOQ, pricing tiers, sample policy, and delivery timelines.\n\nBest regards",
        },
        {
          label: "Email — Tiếng Việt",
          text:
            "Subject: Yêu cầu báo giá — Matcha cao cấp\n\nKính gửi Quý Nhà Cung Cấp,\n\n" +
            "Chúng tôi cần: 500kg matcha ceremonial, giao hàng hàng tháng.\n\n" +
            "Vui lòng gửi giá sỉ, MOQ và thời gian giao hàng.\n\nTrân trọng",
        },
      ],
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
