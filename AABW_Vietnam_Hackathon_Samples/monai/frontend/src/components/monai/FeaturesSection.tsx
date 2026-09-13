import { FEATURES } from "./data";
import { StarBullet } from "./StarBullet";
import { VietnamMap } from "./VietnamMap";

export function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="chili-divider mb-4 font-[family-name:var(--font-punch)]">
            Six Core Capabilities
          </p>
          <h2 className="chopstick-heading font-[family-name:var(--font-display)] text-3xl italic text-nuoc md:text-4xl">
            Món Mới, Món Hot — Trước Ai Cũng Biết
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Every feature is a dish on your intelligence plate — from phở bowls to
            bánh mì cross-sections.
          </p>
        </div>

        <div className="features-bento">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature-card">
              {feature.map ? (
                <VietnamMap />
              ) : feature.image ? (
                <img
                  src={feature.image}
                  alt=""
                  className="feature-card__img"
                />
              ) : null}
              <p className="font-[family-name:var(--font-punch)] text-sm tracking-widest text-toasted">
                {feature.dish}
              </p>
              <h3 className="mt-1 font-[family-name:var(--font-vn)] text-lg font-semibold text-nuoc">
                <span className="mr-2 inline-flex align-middle">
                  <StarBullet />
                </span>
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
