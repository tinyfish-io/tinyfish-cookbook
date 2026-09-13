import { NextRequest, NextResponse } from "next/server";
import { BANKS } from "@/lib/banks";
import { PRODUCTS } from "@/lib/products";
import { fetchApplicationDraft } from "@/lib/apply";
import { addApplication } from "@/lib/sweep";
import { runInBatches } from "@/lib/batch";
import { ApplicantProfile, RateListing } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Fires agents in batches of 5 (not all 8 at once) — each fills that
// bank's real application form up to the final submit step and stops.
export async function POST(req: NextRequest) {
  const { applicant, listings }: { applicant: ApplicantProfile; listings: RateListing[] } = await req.json();
  const product = PRODUCTS.find((p) => p.id === applicant.productId);
  if (!product) return NextResponse.json({ error: "unknown product" }, { status: 400 });

  const drafts = await runInBatches(
    BANKS,
    async (bank) => {
      const listing = listings.find((l) => l.bankId === bank.id && l.productId === product.id);
      if (!listing) return null;
      const draft = await fetchApplicationDraft(bank, product, listing, applicant);
      await addApplication(draft);
      return draft;
    },
    5
  );

  return NextResponse.json({ drafts: drafts.filter(Boolean) });
}
