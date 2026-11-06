import { useState } from "react";
import { verdicts } from "../lib";
import {
  STRINGS,
  VIEW_LABELS,
  chromeFor,
  defaultView,
  detectedLanguage,
  pickText,
  viewsFor,
} from "../i18n";
import Evidence from "./Evidence";

export default function Results({ analysis, selected, onSelect, onClear }) {
  const detected = detectedLanguage(analysis);
  const views = viewsFor(detected);

  // The report opens in the language the user wrote the claim in.
  const [view, setView] = useState(() => defaultView(detected));
  const t = STRINGS[chromeFor(view)];
  const pick = (field) => pickText(field, view);

  const verdict = analysis.final_verdict || analysis.verdict || "";
  const tone = verdicts[verdict]?.tone || "unverified";
  const verdictLabel =
    t.verdicts[verdict] || verdicts[verdict]?.label || verdict.replaceAll("_", " ");
  const meta = { label: verdictLabel, tone };
  const score = analysis.consensus_score;
  const segments = analysis.diff_segments || [];
  const activeSegment = selected !== null ? segments[selected] : null;

  const explanation = pick(analysis.explanation) || t.noExplanation;

  // The claim itself is shown verbatim whenever the view matches the
  // language it was written in; other views show the translation.
  const isOriginalView = view === "original" || view === detected;
  const claimed = isOriginalView
    ? analysis.claim || ""
    : pick(analysis.claim_vs_reality?.claimed) || analysis.claim || "";
  const actual = pick(analysis.claim_vs_reality?.actual) || "";

  const segmentLabel = (segment) =>
    t.labels[segment.label] || segment.label || t.labels.MISLEADING;
  const correctionOf = (segment) => pick(segment.correction);

  // Opens the browser print dialog ("Save as PDF" gives a shareable file).
  // Collapsed lists are expanded and the tab title becomes the PDF file name,
  // then both are restored once the dialog closes.
  function handleShare() {
    const previousTitle = document.title;
    const collapsed = [...document.querySelectorAll(".results details:not([open])")];

    const restore = () => {
      document.title = previousTitle;
      collapsed.forEach((el) => el.removeAttribute("open"));
      window.removeEventListener("afterprint", restore);
    };

    collapsed.forEach((el) => el.setAttribute("open", ""));
    document.title = `TruthLens Fact-Card - ${(analysis.claim || "report").slice(0, 60)}`;
    window.addEventListener("afterprint", restore);
    window.print();
  }

  function focusSegment(index) {
    onSelect(index);
    document
      .getElementById(`evidence-${index}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="results" aria-live="polite">
      <div className="print-header" aria-hidden="true">
        <strong>TruthLens</strong>
        <span>{new Date().toLocaleDateString()}</span>
      </div>

      <div className="section-head">
        <div>
          <div className="kicker">{t.kicker}</div>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        <div className="results-tools">
          <div className="segmented" role="group" aria-label={t.toggleLabel}>
            {views.map((option) => (
              <button
                type="button"
                key={option}
                className={view === option ? "selected" : ""}
                aria-pressed={view === option}
                onClick={() => setView(option)}
              >
                {VIEW_LABELS[option]}
              </button>
            ))}
          </div>
          <button type="button" className="share-button" onClick={handleShare} title={t.shareHint}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9V3h12v6" />
              <rect x="3" y="9" width="18" height="9" rx="2" />
              <path d="M6 14h12v7H6z" />
            </svg>
            {t.share}
          </button>
          <button className="text-button" onClick={onClear}>{t.clear}</button>
        </div>
      </div>

      <div className={`verdict-card ${meta.tone}`}>
        <div className="verdict-copy">
          <span className={`badge ${meta.tone}`}>{meta.label.toUpperCase()}</span>
          <p>{explanation}</p>
        </div>
        <div className="score-panel">
          <span className="kicker">{t.consensus}</span>
          <div className="score-number">
            {score ?? "—"}
            <span>/100</span>
          </div>
          <div className="score-track">
            <span style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }} />
          </div>
          <small>{t.stances[analysis.dominant_stance] || analysis.dominant_stance || t.noStance}</small>
        </div>
      </div>

      {analysis.zombie_suspected && (
        <div className="notice">
          <b>↻</b>
          <div>
            <strong>{t.zombieTitle}</strong>
            <p>{t.zombieBody}</p>
          </div>
        </div>
      )}

      <section className="card">
        <div className="panel-head">
          <div>
            <div className="kicker">{t.breakdownKicker}</div>
            <h3>{t.breakdownTitle}</h3>
          </div>
          <span className="caption">{t.breakdownHint}</span>
        </div>

        <div className="inline-claim" aria-label="Word-by-word claim analysis">
          {segments.map((segment, index) => {
            const label = (segment.label || "MISLEADING").toLowerCase();
            const correction = correctionOf(segment);
            return (
              <button
                type="button"
                key={`${segment.text}-${index}`}
                className={`claim-highlight ${label} ${selected === index ? "chosen" : ""}`}
                onClick={() => focusSegment(index)}
                title={
                  correction
                    ? `${segmentLabel(segment)}: ${correction}`
                    : `${segmentLabel(segment)}: ${t.inspect}`
                }
              >
                {segment.text}
                {correction && <span className="claim-correction"> ({correction})</span>}
              </button>
            );
          })}
        </div>

        <div className="legend">
          <span><i className="dot true" /> {t.legendTrue}</span>
          <span><i className="dot misleading" /> {t.legendMisleading}</span>
          <span><i className="dot false" /> {t.legendFalse}</span>
        </div>

        {activeSegment && (
          <div className={`segment-note ${String(activeSegment.label || "").toLowerCase()}`}>
            <strong>{segmentLabel(activeSegment)}</strong>
            <span>{correctionOf(activeSegment) || t.related}</span>
          </div>
        )}
      </section>

      <section className="compare-grid">
        <article className="card">
          <div className="kicker">{t.claimed}</div>
          <p>{claimed}</p>
        </article>
        <article className="card reality">
          <div className="kicker accent">{t.reality}</div>
          <p>{actual}</p>
        </article>
      </section>

      <Evidence
        analysis={analysis}
        t={t}
        highlightIds={activeSegment?.evidence_chunk_ids || []}
      />

      <p className="disclaimer">
        {t.disclaimer}
      </p>
    </section>
  );
}
