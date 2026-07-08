import type { Product, CompetitorListing, Supplier, RestockAnswer } from "./types";
import { PRODUCTS, SITES, getSupplierForProduct } from "./seed";

export interface FlaggedProduct {
  product: Product;
  supplier: Supplier;
  reason: string;
}

// A product gets flagged if our stock is below its own threshold, OR if
// competitors are visibly well-stocked while we're thin — either way, only
// ever compares against REAL scraped data for the "competitor is better
// stocked" reasoning, never invented numbers.
export function detectLowStock(listings: Record<string, CompetitorListing>): FlaggedProduct[] {
  const flagged: FlaggedProduct[] = [];

  PRODUCTS.forEach((product) => {
    const isLow = product.ourStock <= product.lowStockThreshold;
    if (!isLow) return;

    const competitorStockNotes: string[] = [];
    SITES.forEach((site) => {
      const listing = listings[`${site.id}__${product.id}`];
      if (listing?.inStock) competitorStockNotes.push(site.name);
    });

    const reason =
      competitorStockNotes.length > 0
        ? `Only ${product.ourStock} units left (threshold: ${product.lowStockThreshold}) — ${competitorStockNotes.join(", ")} currently show this in stock, risking lost sales to competitors.`
        : `Only ${product.ourStock} units left (threshold: ${product.lowStockThreshold}) — stock is critically low regardless of competitor availability.`;

    flagged.push({ product, supplier: getSupplierForProduct(product.category), reason });
  });

  return flagged;
}

export async function draftRestockAnswers(
  product: Product,
  supplier: Supplier,
  reason: string,
  listings: Record<string, CompetitorListing>
): Promise<RestockAnswer[]> {
  const apiKey = process.env.GROQ_API_KEY;

  const competitorContext = SITES.map((site) => {
    const listing = listings[`${site.id}__${product.id}`];
    if (!listing) return null;
    return `${site.name}: ${listing.price ? `${listing.price.toLocaleString("vi-VN")} VND` : "price unknown"}, ${listing.inStock === null ? "stock unknown" : listing.inStock ? "in stock" : "out of stock"}`;
  }).filter(Boolean).join("; ");

  if (!apiKey) {
    return heuristicAnswers(product, supplier, reason);
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: [
              "You are a retail procurement assistant drafting a restock request form for a Vietnamese electronics retailer to send to a supplier.",
              "You will receive: the product, current stock level, the reason it was flagged, and real competitor pricing/stock context.",
              "Fill in each form field factually and concisely, based only on the data given — never invent numbers, competitor names, or facts not provided.",
              "The 'reason'/'justification' style fields should read like a real internal note from a procurement team — plain, factual, no marketing language, no exclamation marks.",
              'Respond with ONLY a raw JSON object: {"answers": [{"fieldId": "product", "draft": "..."}, ...]} — one entry per field id given.',
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              product: product.name,
              category: product.category,
              currentStock: product.ourStock,
              lowStockThreshold: product.lowStockThreshold,
              ourPrice: product.ourPrice,
              flagReason: reason,
              competitorContext: competitorContext || "no competitor data available yet",
              formFields: supplier.formFields.map((f) => ({ id: f.id, label: f.label, type: f.type, helper: f.helper })),
            }),
          },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    if (!res.ok) return heuristicAnswers(product, supplier, reason);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const rawAnswers = Array.isArray(parsed?.answers) ? parsed.answers : [];

    return supplier.formFields.map((field) => {
      const match = rawAnswers.find((a: any) => a?.fieldId === field.id);
      return {
        fieldId: field.id,
        label: field.label,
        draft: typeof match?.draft === "string" && match.draft.trim() ? match.draft : heuristicAnswerFor(field.id, product, reason),
        edited: false,
      };
    });
  } catch {
    return heuristicAnswers(product, supplier, reason);
  }
}

function heuristicAnswerFor(fieldId: string, product: Product, reason: string): string {
  switch (fieldId) {
    case "product":
      return product.name;
    case "quantity":
      return String(Math.max(product.lowStockThreshold * 2 - product.ourStock, 10));
    case "currentStock":
      return String(product.ourStock);
    case "reason":
    case "competitiveNote":
      return reason;
    case "timeframe":
      return "Within 2 weeks";
    case "priority":
      return product.ourStock === 0 ? "Urgent" : "Standard";
    default:
      return "";
  }
}

function heuristicAnswers(product: Product, supplier: Supplier, reason: string): RestockAnswer[] {
  return supplier.formFields.map((field) => ({
    fieldId: field.id,
    label: field.label,
    draft: heuristicAnswerFor(field.id, product, reason),
    edited: false,
  }));
}
