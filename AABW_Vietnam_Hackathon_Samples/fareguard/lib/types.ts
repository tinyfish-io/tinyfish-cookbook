export type RouteCode = string;

export interface RouteInfo {
  code: RouteCode;
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  label: string;
}

export interface SiteInfo {
  id: string;
  name: string;
  type: "Airline" | "OTA";
  supportsAutoFill: boolean;
  url: string;
  // Skyscanner has a documented, public deep-link URL format
  // (/transport/flights/{from}/{to}/{YYMMDD}/), so it can be read with the
  // free Fetch API instead of the slower, paid Agent automation. Every
  // other site here is a search-form-driven booking engine with no known
  // deep-link format, so they stay on Agent.
  useFetch?: boolean;
}

export interface ScheduleMeta {
  lastSweepAt: string | null;
  sweepStartedAt: string | null;
  lastAnalyzeAt: string | null;
  lastDispatchedAt: string | null;
  sweepIntervalMs: number;
  analyzeIntervalMs: number;
  usingRealAgents: boolean;
}

export interface PricePoint {
  timestamp: string;
  priceVnd: number;
  source: "seed" | "real" | "simulated";
}

export interface SitePriceSeries {
  siteId: string;
  routeCode: RouteCode;
  history: PricePoint[];
}

export interface AgentStatus {
  siteId: string;
  status: "idle" | "running" | "done" | "error";
  lastSyncedAt: string | null;
  routesCovered: RouteCode[];
}

export interface BookingRequest {
  id: string;
  passengerName: string;
  routeCode: RouteCode;
  travelDate: string;
  thresholdVnd: number;
  preferredSiteId: string;
  status: "waiting" | "booked";
  createdAt: string;
}

export interface RouteRecommendation {
  routeCode: RouteCode;
  recommendation: string;
  bookByDate: string;
  confidence: "low" | "medium" | "high";
}
