import { Reader } from "./Reader";

export const metadata = { title: "Reading — Kenshō" };

export default async function ReadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ch?: string; p?: string; claim?: string; start?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  return <Reader id={id} initialChapter={Math.max(1, Number(sp.ch) || 1)} initialPage={Math.max(1, Number(sp.p) || 1)} initialClaim={sp.claim ?? null} autoStart={sp.start === "1"} />;
}
