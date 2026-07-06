import banhmi from "@/assets/banhmi.png";
import banhxeo from "@/assets/banhxeo.png";
import bunbohue from "@/assets/bunbohue.png";
import capthrung from "@/assets/capthrung.png";
import pho from "@/assets/pho.png";

export const TICKER_SOURCES = [
  "TikTok",
  "Facebook",
  "GrabFood",
  "ShopeeFood",
  "Foody.vn",
  "Instagram",
  "YouTube Shorts",
  "Highlands Coffee",
  "Phúc Long",
  "Katinat",
];

export const FEATURES = [
  {
    title: "Emerging Trend Detection",
    dish: "Phở",
    description:
      "Spot viral dishes and ingredients across Vietnamese social media before they peak.",
    image: pho,
    wide: false,
  },
  {
    title: "Viral Trend Forecasting",
    dish: "Cà Phê Trứng",
    description:
      "AI-powered growth curves predict which coffee and beverage trends will explode next quarter.",
    image: capthrung,
    wide: false,
  },
  {
    title: "Menu Gap Analysis",
    dish: "Bánh Mì",
    description:
      "Cross-section your menu against competitors — find missing items your customers already crave.",
    image: banhmi,
    wide: false,
  },
  {
    title: "Regional Food Intelligence",
    dish: "Việt Nam",
    description:
      "Hyper-local insights from Hà Nội, TP.HCM, Đà Nẵng, Huế, and emerging second-tier cities.",
    image: null,
    wide: false,
    map: true,
  },
  {
    title: "Supplier Discovery Agent",
    dish: "Bún Bò Huế",
    description:
      "Find verified ingredient suppliers, wholesalers, and specialty producers across Vietnam.",
    image: bunbohue,
    wide: false,
  },
  {
    title: "Automated Supplier Outreach",
    dish: "Bánh Xèo",
    description:
      "AI drafts RFQs, negotiates samples, and tracks supplier responses — so you launch faster.",
    image: banhxeo,
    wide: false,
  },
];

export const AUDIENCES = [
  {
    title: "Coffee Chains",
    body: "Highlands, Phúc Long, Katinat, The Coffee House — stay ahead of the next viral drink.",
    stamp: "HOT TREND",
  },
  {
    title: "Restaurant Groups",
    body: "Multi-brand F&B operators, franchise owners, and expansion teams scaling across Vietnam.",
    stamp: "MÓN MỚI",
  },
  {
    title: "Food Manufacturers",
    body: "Beverage brands, ingredient producers, and packaged goods companies innovating for VN palates.",
    stamp: "MÓN MỚI",
  },
  {
    title: "Product Innovation Teams",
    body: "Category managers, product strategists, and market research teams launching faster.",
    stamp: "HOT TREND",
  },
];

export const WORKFLOW_STEPS = [
  { layer: "Bánh", label: "Detect", detail: "Monitor TikTok, Facebook, delivery apps 24/7" },
  { layer: "Pâté", label: "Validate", detail: "Cross-reference social signals with sales data" },
  { layer: "Thịt", label: "Analyze", detail: "Menu gap analysis vs. regional competitors" },
  { layer: "Dưa", label: "Score", detail: "AI confidence scoring and growth forecasting" },
  { layer: "Rau", label: "Source", detail: "Discover verified suppliers and wholesalers" },
  { layer: "Ớt", label: "RFQ", detail: "Automated outreach and sample negotiation" },
  { layer: "Vỏ", label: "Launch", detail: "Ship the trend before your competitors do" },
];
