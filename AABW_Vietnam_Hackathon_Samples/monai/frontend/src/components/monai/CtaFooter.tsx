import { Link } from "@tanstack/react-router";

export function CtaFooter() {
  return (
    <section id="cta" className="px-6 py-20">
      <div className="cta-leaf-border mx-auto max-w-3xl px-8 py-14 text-center">
        <span className="stamp mb-6">Bắt đầu ngay</span>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl italic text-nuoc md:text-4xl">
          Get Started with MónAI
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          Join Vietnam&apos;s leading F&amp;B brands using AI to spot trends, close menu
          gaps, and launch faster than the competition.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link to="/dashboard" className="btn-primary">
            Bắt đầu ngay
          </Link>
          <a href="#features" className="btn-outline">
            Explore Features
          </a>
        </div>
      </div>
    </section>
  );
}
