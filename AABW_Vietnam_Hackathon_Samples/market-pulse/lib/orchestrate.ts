import { store } from "./store";
import { runPricingSweep, mergeListingsForSite } from "./pricing";
import { detectLowStock, draftRestockAnswers } from "./restock";
import type { RestockRequest } from "./types";

export async function runSweepAndSave(reason: string) {
  console.log(`[sweep] starting — reason: ${reason}`);
  await store.setMeta({ sweepStartedAt: new Date().toISOString() });

  const { agentStatuses } = await runPricingSweep(async (site, result, status) => {
    // Persist the moment THIS site finishes — not after all 5 are done —
    // so anyone polling the store sees results progressively, not in one
    // batch at the very end.
    if (result) {
      const current = await store.getListings();
      const merged = mergeListingsForSite(site, result, current);
      await store.setListings(merged);
    }
    const currentStatuses = await store.getAgentStatuses();
    currentStatuses[site.id] = status;
    await store.setAgentStatuses(currentStatuses);
    console.log(`[sweep] ${site.name} done — ${status.listingsFound} listings found`);
  });

  await store.setAgentStatuses(agentStatuses);
  await store.setMeta({
    lastSweepAt: new Date().toISOString(),
    usingRealAgents: Boolean(process.env.TINYFISH_API_KEY),
  });

  // Auto-flag any product that's now below its stock threshold, creating a
  // restock request if one doesn't already exist for it.
  const listings = await store.getListings();
  const flagged = detectLowStock(listings);
  const existing = await store.getRestockRequests();
  const existingProductIds = new Set(existing.filter((r) => r.stage !== "submitted").map((r) => r.productId));

  const newRequests: RestockRequest[] = flagged
    .filter((f) => !existingProductIds.has(f.product.id))
    .map((f) => ({
      id: `restock-${f.product.id}-${Date.now()}`,
      productId: f.product.id,
      productName: f.product.name,
      supplierId: f.supplier.id,
      supplierName: f.supplier.name,
      stage: "flagged",
      reason: f.reason,
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submittedAt: null,
    }));

  if (newRequests.length > 0) {
    await store.setRestockRequests([...newRequests, ...existing]);
    console.log(`[sweep] flagged ${newRequests.length} new restock request(s)`);

    // Auto-draft immediately — no need for a manual "Draft with AI" click.
    // The founder still reviews/edits everything before it's submitted.
    for (const req of newRequests) {
      try {
        await draftRestockRequest(req.id);
        console.log(`[sweep] auto-drafted restock request for ${req.productName}`);
      } catch (err) {
        console.error(`[sweep] auto-draft failed for ${req.productName}:`, err);
      }
    }
  }

  return { sitesSwept: Object.keys(agentStatuses).length, newRestockFlags: newRequests.length };
}

// Advances a flagged restock request through drafting → ready, using Groq
// to fill the fixed supplier form template. Stops at "ready" for human
// review — submit is a separate explicit action.
export async function draftRestockRequest(requestId: string) {
  const requests = await store.getRestockRequests();
  const request = requests.find((r) => r.id === requestId);
  if (!request) throw new Error("Restock request not found");

  const { PRODUCTS, SUPPLIERS } = await import("./seed");
  const product = PRODUCTS.find((p) => p.id === request.productId);
  const supplier = SUPPLIERS.find((s) => s.id === request.supplierId);
  if (!product || !supplier) throw new Error("Product or supplier not found");

  const updated = requests.map((r) => (r.id === requestId ? { ...r, stage: "drafting" as const, updatedAt: new Date().toISOString() } : r));
  await store.setRestockRequests(updated);

  const listings = await store.getListings();
  const answers = await draftRestockAnswers(product, supplier, request.reason, listings);

  const final = updated.map((r) =>
    r.id === requestId ? { ...r, stage: "ready" as const, answers, updatedAt: new Date().toISOString() } : r
  );
  await store.setRestockRequests(final);
  return final.find((r) => r.id === requestId);
}

let bootstrapChecked = false;
export function bootstrapLocalDevIfNeeded() {
  if (process.env.VERCEL) return;
  if (!process.env.TINYFISH_API_KEY) return;
  if (bootstrapChecked) return;
  bootstrapChecked = true;

  store.getMeta().then((meta) => {
    if (meta.sweepStartedAt !== null) return;
    console.log("[bootstrap] first run detected, starting real sweep in the background...");
    runSweepAndSave("local-dev-bootstrap (first ever run)")
      .then(() => console.log("[bootstrap] background sweep complete"))
      .catch((err) => console.error("[bootstrap] background sweep failed:", err));
  });
}
