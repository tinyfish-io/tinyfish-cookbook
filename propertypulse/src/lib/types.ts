export type PropertyType = "apartment" | "house";
export type ListingIntent = "rent" | "sale";

export interface Portal {
  id: string;
  name: string;
  url: string;
}

export interface TrackedSearch {
  id: string;
  area: string; // free text, e.g. "District 2, Thao Dien"
  propertyType: PropertyType;
  intent: ListingIntent;
  clientName: string | null; // optional label for the agency's own reference
  createdAt: string;
  lastSweptAt: string | null;
}

export interface Listing {
  searchId: string;
  portalId: string;
  title: string;
  price: number; // VND — for rent this is monthly, for sale it's total
  areaSqm: number | null;
  bedrooms: number | null;
  url: string;
  checkedAt: string;
  source: "real";
}

export interface AgentStatus {
  portalId: string;
  status: "done" | "error";
  lastSyncedAt: string;
  listingsFound: number;
}

export interface ScheduleMeta {
  usingRealAgents: boolean;
  lastDispatchedAt: string | null;
}
