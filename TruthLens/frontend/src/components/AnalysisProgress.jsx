import { useEffect, useRef, useState } from "react";
import { STEPS } from "../progress";

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return seconds;
}

function StepDetail({ id, status, progress }) {
  const { queries, searches, sources, fetched, requested } = progress;

  if (id === "planning") {
    return status === "active" ? (
      <p className="step-note">Working out what to search for…</p>
    ) : (
      <p className="step-note">{queries.length} search queries ready</p>
    );
  }

  if (id === "searching") {
    if (status === "done") {
      const total = searches.reduce((sum, s) => sum + s.found, 0);
      return <p className="step-note">{searches.length} searches done · {total} results found</p>;
    }
    return (
      <ul className="query-list">
        {queries.map((query, index) => {
          const result = searches[index];
          const state = result ? "done" : index === searches.length ? "active" : "pending";
          return (
            <li key={query} className={state}>
              <i />
              <span>{query}</span>
              {result && <small>{result.ok ? `${result.found} results` : "failed"}</small>}
            </li>
          );
        })}
      </ul>
    );
  }

  if (id === "fetching") {
    if (sources.length === 0) return <p className="step-note">No usable sources found.</p>;
    const read = fetched !== null;
    return (
      <>
        <p className="step-note">
          {read ? `Read ${fetched} of ${requested} pages` : `Fetching ${sources.length} pages…`}
        </p>
        <ul className="source-list">
          {sources.map((source) => (
            <li key={source.url}>
              <span className="avatar small">{(source.domain || "?").slice(0, 1).toUpperCase()}</span>
              <span className="source-domain">{source.domain || source.url}</span>
              <small className="mono">Tier {source.tier ?? "—"}</small>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <p className="step-note">Weighing the evidence and checking every quote against its source…</p>
  );
}

export default function AnalysisProgress({ progress }) {
  const elapsed = useElapsedSeconds();
  const cardRef = useRef(null);

  // Bring the card into view when an analysis starts.
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const current = STEPS.findIndex((step) => step.id === progress.stage);

  return (
    <section className="card progress-card" aria-live="polite" ref={cardRef}>
      <div className="panel-head">
        <div>
          <div className="kicker">INVESTIGATING</div>
          <h3>Analyzing your claim</h3>
        </div>
        <span className="pill">{elapsed}s</span>
      </div>

      <ol className="steps">
        {STEPS.map((step, index) => {
          const status = index < current ? "done" : index === current ? "active" : "pending";
          return (
            <li key={step.id} className={`step ${status}`}>
              <span className="step-icon">
                {status === "done" ? "✓" : status === "active" ? <span className="ring" /> : null}
              </span>
              <div className="step-body">
                <strong>{step.title}</strong>
                {status !== "pending" && (
                  <StepDetail id={step.id} status={status} progress={progress} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
