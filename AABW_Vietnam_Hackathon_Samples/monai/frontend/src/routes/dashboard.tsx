import { createFileRoute } from "@tanstack/react-router";
import { AnalysisPanel } from "@/components/monai/AnalysisPanel";
import { SiteFooter } from "@/components/monai/SiteFooter";
import { SiteHeader } from "@/components/monai/SiteHeader";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader variant="app" />
      <main>
        <AnalysisPanel />
      </main>
      <SiteFooter />
    </div>
  );
}
