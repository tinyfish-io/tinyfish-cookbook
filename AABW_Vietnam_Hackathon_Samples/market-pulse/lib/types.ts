export type Category = "Laptops" | "PC Components";

export interface CompetitorSite {
  id: string;
  name: string;
  url: string;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  searchTerm: string; // what agents search for on competitor sites
  ourPrice: number; // VND — simulated — no real access to an internal inventory system
  ourStock: number; // simulated, deliberately seeded low on at least one item
  lowStockThreshold: number;
}

export interface CompetitorListing {
  siteId: string;
  productId: string;
  price: number | null;
  inStock: boolean | null;
  lastChecked: string;
  source: "seed" | "real";
}

export interface AgentStatus {
  siteId: string;
  status: "done" | "error";
  lastSyncedAt: string | null;
  listingsFound: number;
}

export type SupplierFieldType = "text" | "textarea" | "number";

export interface SupplierFormField {
  id: string;
  label: string;
  type: SupplierFieldType;
  helper?: string;
}

export interface Supplier {
  id: string;
  name: string;
  categorySpecialty: string;
  formFields: SupplierFormField[];
}

export type RestockStage = "flagged" | "drafting" | "ready" | "submitted";

export interface RestockAnswer {
  fieldId: string;
  label: string;
  draft: string;
  edited: boolean;
}

export interface RestockRequest {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  stage: RestockStage;
  reason: string;
  answers: RestockAnswer[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface ScheduleMeta {
  lastSweepAt: string | null;
  sweepStartedAt: string | null;
  sweepIntervalMs: number;
  usingRealAgents: boolean;
  lastDispatchedAt: string | null;
}
