import { createFileRoute } from "@tanstack/react-router";
import { AnalysisPanel } from "@/components/monai/AnalysisPanel";
import { CtaFooter } from "@/components/monai/CtaFooter";
import { FeaturesSection } from "@/components/monai/FeaturesSection";
import { HeroSection } from "@/components/monai/HeroSection";
import { ProblemTicker } from "@/components/monai/ProblemTicker";
import { SiteFooter } from "@/components/monai/SiteFooter";
import { SiteHeader } from "@/components/monai/SiteHeader";
import { TrendsBoard } from "@/components/monai/TrendsBoard";
import { UsersSection } from "@/components/monai/UsersSection";
import { WorkflowSection } from "@/components/monai/WorkflowSection";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <HeroSection />
        <ProblemTicker />
        <FeaturesSection />
        <TrendsBoard />
        <UsersSection />
        <WorkflowSection />
        <AnalysisPanel />
        <CtaFooter />
      </main>
      <SiteFooter />
    </div>
  );
}
