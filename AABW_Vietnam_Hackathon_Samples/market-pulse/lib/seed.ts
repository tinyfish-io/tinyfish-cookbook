import type { CompetitorSite, Supplier, Product } from "./types";

// 5 real competitors in the Vietnam laptop/PC retail space, confirmed via research.
export const SITES: CompetitorSite[] = [
  { id: "tgdd", name: "The Gioi Di Dong", url: "https://www.thegioididong.com/" },
  { id: "fptshop", name: "FPT Shop", url: "https://fptshop.com.vn/" },
  { id: "cellphones", name: "CellphoneS", url: "https://cellphones.com.vn/" },
  { id: "nguyenkim", name: "Nguyen Kim", url: "https://www.nguyenkim.com/" },
  { id: "gearvn", name: "Gear.vn", url: "https://gear.vn/" },
];

// 3 real Vietnam IT distributors. Per the decision to keep RFQ/PO forms
// fixed rather than scraped (these B2B relationships use standard forms in
// practice) — hand-built once, Groq fills them in per restock request.
export const SUPPLIERS: Supplier[] = [
  {
    id: "synnex-fpt",
    name: "Synnex FPT",
    categorySpecialty: "Laptops & electronics distribution",
    formFields: [
      { id: "product", label: "Product / SKU", type: "text" },
      { id: "quantity", label: "Quantity requested", type: "number" },
      { id: "currentStock", label: "Current stock on hand", type: "number" },
      { id: "reason", label: "Reason for restock request", type: "textarea", helper: "Explain the demand/stock situation driving this request" },
      { id: "timeframe", label: "Requested delivery timeframe", type: "text" },
      { id: "priority", label: "Priority level", type: "text", helper: "Standard, Expedited, or Urgent" },
    ],
  },
  {
    id: "digiworld",
    name: "Digiworld",
    categorySpecialty: "Laptops, components & consumer electronics",
    formFields: [
      { id: "product", label: "Product name", type: "text" },
      { id: "quantity", label: "Order quantity", type: "number" },
      { id: "reason", label: "Business justification", type: "textarea", helper: "Why is this order needed now" },
      { id: "competitiveNote", label: "Market/competitive context", type: "textarea", helper: "Any relevant competitor pricing or stock info" },
      { id: "timeframe", label: "Needed by", type: "text" },
    ],
  },
  {
    id: "petrosetco",
    name: "Petrosetco (PSD)",
    categorySpecialty: "PC components & peripherals distribution",
    formFields: [
      { id: "product", label: "Component / SKU", type: "text" },
      { id: "quantity", label: "Quantity", type: "number" },
      { id: "currentStock", label: "Current stock on hand", type: "number" },
      { id: "reason", label: "Reason for order", type: "textarea" },
      { id: "priority", label: "Priority", type: "text" },
    ],
  },
];

function supplierForCategory(category: Product["category"]): string {
  return category === "Laptops" ? "synnex-fpt" : "petrosetco";
}

// Staging phase: just 1 laptop + 1 PC component, deliberately kept small so
// agent runs stay fast while testing. Expand this list once the pipeline
// is proven out.
const RAW_PRODUCTS: Omit<Product, "id">[] = [
  { name: "Acer Nitro 5", category: "Laptops", searchTerm: "Acer Nitro 5", ourPrice: 21990000, ourStock: 2, lowStockThreshold: 8 }, // deliberately low — guarantees a restock case to test
  { name: "Kingston NV2 1TB SSD", category: "PC Components", searchTerm: "Kingston NV2 1TB", ourPrice: 1290000, ourStock: 30, lowStockThreshold: 12 },
];

export const PRODUCTS: Product[] = RAW_PRODUCTS.map((p, i) => ({
  ...p,
  id: `product-${i}`,
}));

export function getSupplierForProduct(category: Product["category"]): Supplier {
  const id = supplierForCategory(category);
  return SUPPLIERS.find((s) => s.id === id) ?? SUPPLIERS[0];
}
