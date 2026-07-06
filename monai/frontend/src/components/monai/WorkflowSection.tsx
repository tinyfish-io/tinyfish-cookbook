import { WORKFLOW_STEPS } from "./data";

export function WorkflowSection() {
  return (
    <section id="workflow" className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <p className="chili-divider mb-4 font-[family-name:var(--font-punch)]">
            End-to-End Workflow
          </p>
          <h2 className="chopstick-heading font-[family-name:var(--font-display)] text-3xl italic text-nuoc md:text-4xl">
            Assembled Layer by Layer
          </h2>
          <p className="mt-3 text-muted-foreground">
            Like building the perfect bánh mì — detect, validate, analyze, score,
            source, RFQ, launch.
          </p>
        </div>

        <div className="banhmi-timeline">
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.label} className="banhmi-step">
              <p className="font-[family-name:var(--font-punch)] text-xs tracking-widest text-toasted">
                {step.layer}
              </p>
              <h3 className="mt-0.5 font-[family-name:var(--font-vn)] text-lg font-semibold text-nuoc">
                {step.label}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="leaf-divider mx-auto mt-16 max-w-6xl" />
    </section>
  );
}
