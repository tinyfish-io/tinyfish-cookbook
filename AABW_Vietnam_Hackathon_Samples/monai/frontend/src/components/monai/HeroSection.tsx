import { Link } from "@tanstack/react-router";

import { HeroCollage } from "./HeroCollage";

export function HeroSection() {
  return (
    <section className="paper-texture relative overflow-hidden px-6 pb-16 pt-12 md:pb-24 md:pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="relative z-10">
          <span className="stamp mb-6">24/7 Trend Agent</span>

          <h1 className="wordmark mt-4">
            Món<span className="tone-chili">A</span>
            <span className="tone-leaf">I</span>
          </h1>

          <p className="mt-2 font-[family-name:var(--font-display)] text-xl italic text-toasted md:text-2xl">
            Vietnam&apos;s AI-Powered Food Trend Intelligence
          </p>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
            From Hà Nội phở stalls to TP.HCM coffee chains — MónAI watches every
            corner of Vietnam&apos;s food scene so you launch the next viral dish first.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a href="#trends" className="btn-primary">
              Discover Trends
            </a>
            <Link to="/dashboard" className="btn-outline">
              Open Dashboard
            </Link>
          </div>
        </div>

        <div className="relative">
          <HeroCollage />
        </div>
      </div>

      <div className="leaf-divider absolute bottom-0 left-0 right-0" />
    </section>
  );
}
