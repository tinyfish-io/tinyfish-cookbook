import { getSharedAudit } from "../lib/api.ts";
import { SAMPLE_REPORT_TOKEN, sampleCard } from "../lib/sample.ts";
import { siteName } from "../lib/sites.ts";
import { useLoad } from "../lib/useLoad.ts";
import { Chevron } from "./icons.tsx";
import { Link, Pill, SiteAvatar } from "./ui.tsx";

/** A finished report at a glance, so a first visit shows what an audit gives back. */
export function SampleReport() {
  const { result } = useLoad(SAMPLE_REPORT_TOKEN, () => getSharedAudit(SAMPLE_REPORT_TOKEN));
  // A sample that cannot load is a nicety lost, so the home page simply goes without it.
  const card = result.state === "ready" ? sampleCard(result.data, SAMPLE_REPORT_TOKEN) : null;
  if (!card) return null;

  return (
    <section
      aria-labelledby="sample-title"
      className="rise card relative mt-10 w-full max-w-[720px] p-4 text-left transition-shadow hover:shadow-lg sm:mt-12 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <SiteAvatar host={card.host} small />
        <div className="min-w-0 flex-1">
          <h2 id="sample-title" className="text-base tracking-[-0.01em]">
            {siteName(card.host, card.name)}
          </h2>
          <p className="text-[13px] text-mute">{card.task}</p>
        </div>
        <span className="pill pill-info shrink-0">Sample report</span>
      </div>

      {card.quote ? (
        <blockquote className="mt-3.5 border-l-2 border-found py-0.5 pl-3.5 font-serif text-[19px]/[1.3] text-ink italic">
          &ldquo;{card.quote}&rdquo;
        </blockquote>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <ul aria-label="Patterns found" className="contents">
          {card.pills.map((label) => (
            <li key={label}>
              <Pill tone="found" text={label} />
            </li>
          ))}
        </ul>
        {card.more > 0 ? <span className="text-[13px] text-mute">and {card.more} more</span> : null}
        <Link
          href={card.href}
          className="link ml-auto inline-flex min-h-11 items-center gap-1 font-medium after:absolute after:inset-0 after:rounded-card sm:min-h-6"
        >
          Open the report
          <Chevron size={14} />
        </Link>
      </div>
    </section>
  );
}
