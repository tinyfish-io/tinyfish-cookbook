import { SiteHeader } from "@/components/ui/chrome";
import { SearchView } from "./SearchView";

export const metadata = { title: "Discover papers — Kenshō" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  return (
    <>
      <SiteHeader step="discover" />
      <SearchView key={q} q={q} />
    </>
  );
}
