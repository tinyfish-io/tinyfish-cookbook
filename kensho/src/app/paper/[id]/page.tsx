import { SiteHeader, Footer } from "@/components/ui/chrome";
import { PaperView } from "./PaperView";

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SiteHeader step="paper" />
      <PaperView id={id} />
      <Footer />
    </>
  );
}
