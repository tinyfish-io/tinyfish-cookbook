import { Copy, Check, ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { IntelligenceReport } from "./analysisExamples";

function parseInlineEmphasis(text: string, blockId: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let partIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${blockId}-${partIndex++}`;
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key} className="font-semibold text-nuoc">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <em key={key} className="italic text-toasted">
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : [text];
}

function RichText({ text, blockId }: { text: string; blockId: string }) {
  return <>{parseInlineEmphasis(text, blockId)}</>;
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="rounded-lg border border-border bg-cream/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-cilantro">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-nuoc"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-nuoc">{text}</div>
    </div>
  );
}

export function IntelligenceReportView({ report }: { report: IntelligenceReport }) {
  return (
    <article className="intel-report space-y-8 rounded-xl border border-border bg-card p-6 md:p-8">
      <header className="space-y-2 border-b border-border pb-6">
        <h3 className="font-[family-name:var(--font-display)] text-2xl italic leading-snug text-nuoc md:text-3xl">
          {report.headline}
        </h3>
        {report.subtitle && (
          <p className="text-sm font-medium leading-relaxed text-muted-foreground">{report.subtitle}</p>
        )}
      </header>

      {report.metrics && report.metrics.length > 0 && (
        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cilantro">Key metrics</h4>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg bg-muted/60 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</dt>
                <dd className="mt-1 text-base font-semibold text-nuoc">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {report.paragraphs && report.paragraphs.length > 0 && (
        <section className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-cilantro">Executive summary</h4>
          {report.paragraphs.map((paragraph, index) => (
            <div key={`p-${index}`} className="text-base leading-7 text-nuoc">
              <RichText text={paragraph} blockId={`p-${index}`} />
            </div>
          ))}
        </section>
      )}

      {report.cards && report.cards.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-cilantro">Detailed findings</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {report.cards.map((card, index) => (
              <div key={index} className="rounded-lg border border-border bg-cream/40 p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-nuoc">{card.title}</p>
                    {card.subtitle && (
                      <p className="mt-0.5 text-xs font-medium text-chili">{card.subtitle}</p>
                    )}
                  </div>
                  {card.tag && (
                    <span className="rounded-full bg-cilantro/10 px-2 py-0.5 text-xs text-cilantro">{card.tag}</span>
                  )}
                </div>
                <div className="text-sm leading-relaxed text-muted-foreground">
                  <RichText text={card.body} blockId={`card-${index}`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.sections?.map((section, index) => (
        <section key={index} className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-cilantro">{section.title}</h4>
          {section.paragraphs?.map((p, i) => (
            <div key={`section-${index}-p-${i}`} className="text-sm leading-7 text-nuoc">
              <RichText text={p} blockId={`section-${index}-p-${i}`} />
            </div>
          ))}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="space-y-2">
              {section.bullets.map((bullet, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-nuoc">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-chili" aria-hidden="true" />
                  <span><RichText text={bullet} blockId={`section-${index}-bullet-${i}`} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {report.bullets && report.bullets.length > 0 && (
        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cilantro">Highlights</h4>
          <ul className="space-y-2">
            {report.bullets.map((bullet, index) => (
              <li key={index} className="flex gap-2 text-sm leading-relaxed text-nuoc">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-chili" aria-hidden="true" />
                <span><RichText text={bullet} blockId={`hl-${index}`} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.sources && report.sources.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-cilantro">Sources & evidence</h4>
          {report.sources.map((source, index) => (
            <div key={index} className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-nuoc">{source.title}</p>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-cilantro hover:text-nuoc"
                    aria-label={`Open source: ${source.title}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {source.excerpt && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{source.excerpt}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {report.actions && report.actions.length > 0 && (
        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cilantro">Recommended actions</h4>
          <ol className="space-y-2">
            {report.actions.map((action, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed text-nuoc">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chili/10 text-xs font-semibold text-chili">
                  {index + 1}
                </span>
                <span className="pt-0.5"><RichText text={action} blockId={`action-${index}`} /></span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {report.ready_to_use && report.ready_to_use.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-cilantro">Ready to use</h4>
          <p className="text-xs text-muted-foreground">
            Copy, personalize, and send — formatted for email, Slack, or internal memos.
          </p>
          {report.ready_to_use.map((block, index) => (
            <CopyBlock key={`${block.label}-${index}`} label={block.label} text={block.text} />
          ))}
        </section>
      )}
    </article>
  );
}

export function ExampleReportPreview({ report }: { report: IntelligenceReport }) {
  return (
    <div className="rounded-xl border border-dashed border-crust/40 bg-cream/30 p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Example output — run analysis for live results
      </p>
      <IntelligenceReportView report={report} />
    </div>
  );
}
