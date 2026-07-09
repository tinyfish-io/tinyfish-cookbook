import { NextRequest, NextResponse } from "next/server";
import { getProfile, setProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getProfile();
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const profile = await req.json();
  await setProfile(profile);
  return NextResponse.json({ ok: true });
}
