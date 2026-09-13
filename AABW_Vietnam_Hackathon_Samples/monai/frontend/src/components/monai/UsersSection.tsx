import { AUDIENCES } from "./data";
import { StarBullet } from "./StarBullet";

export function UsersSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="chopstick-heading font-[family-name:var(--font-display)] text-3xl italic text-nuoc md:text-4xl">
            Built for Vietnam&apos;s F&amp;B Leaders
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {AUDIENCES.map((audience) => (
            <article key={audience.title} className="user-card">
              <span className={`stamp ${audience.stamp === "HOT TREND" ? "stamp--hot" : ""}`}>
                {audience.stamp}
              </span>
              <h3 className="flex items-center gap-2 font-[family-name:var(--font-vn)] text-xl font-semibold text-nuoc">
                <StarBullet />
                {audience.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {audience.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
