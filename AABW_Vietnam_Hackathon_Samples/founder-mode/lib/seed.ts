import type { CompanyProfile, SiteInfo } from "./types";

// The 6 real sources agreed on: 5 named Vietnam accelerators/programs plus
// F6S as the aggregator covering breadth beyond them. F6S also frequently
// hosts the actual application form for these programs.
export const SITES: SiteInfo[] = [
  { id: "viisa", name: "VIISA", url: "https://www.viisa.vn/", kind: "accelerator", hasPortfolio: true },
  { id: "vsv-capital", name: "VSV Capital", url: "https://www.vsvcapital.com.vn/accelerator", kind: "accelerator", hasPortfolio: true },
  { id: "thinkzone", name: "ThinkZone", url: "https://thinkzone.vn/", kind: "accelerator", hasPortfolio: true },
  { id: "antler-vietnam", name: "Antler Vietnam", url: "https://www.antler.co/location/vietnam", kind: "accelerator", hasPortfolio: true },
  { id: "techfest", name: "Techfest Vietnam", url: "https://techfest.vn/", kind: "government", hasPortfolio: false },
  { id: "f6s", name: "F6S", url: "https://www.f6s.com/directory/programs", kind: "aggregator", hasPortfolio: false },
];

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "",
  pitch: "",
  sector: "",
  stage: "",
  website: "",
  tractionSummary: "",
  founders: [],
};
