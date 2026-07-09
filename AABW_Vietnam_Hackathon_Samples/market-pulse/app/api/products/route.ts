import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { bootstrapLocalDevIfNeeded } from "@/lib/orchestrate";
import { PRODUCTS, SITES } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  bootstrapLocalDevIfNeeded();
  const listings = await store.getListings();
  return NextResponse.json({ products: PRODUCTS, sites: SITES, listings });
}
