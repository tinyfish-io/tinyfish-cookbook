import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { CompanyProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await store.getCompanyProfile();
  return NextResponse.json({ profile });
}

// Saves whatever the founder typed into the form — this is what future
// drafting runs pull from, so edits here take effect on the next
// application drafted.
export async function PUT(req: Request) {
  const body = await req.json();
  const profile: CompanyProfile = {
    name: String(body.name ?? ""),
    pitch: String(body.pitch ?? ""),
    sector: String(body.sector ?? ""),
    stage: String(body.stage ?? ""),
    website: String(body.website ?? ""),
    tractionSummary: String(body.tractionSummary ?? ""),
    founders: Array.isArray(body.founders)
      ? body.founders.map((f: any) => ({
          name: String(f.name ?? ""),
          role: String(f.role ?? ""),
          bio: String(f.bio ?? ""),
        }))
      : [],
  };
  await store.setCompanyProfile(profile);
  return NextResponse.json({ profile });
}
