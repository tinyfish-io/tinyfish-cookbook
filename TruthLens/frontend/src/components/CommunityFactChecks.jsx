import { useEffect, useState } from "react";
import { fetchCommunityClaims, markClaimSeen, unmarkClaimSeen } from "../api";
import { timeAgo, verdicts } from "../lib";
import ChallengeForm from "./ChallengeForm";

const PAGE_SIZE = 8;

const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "seen", label: "Most seen" },
];

// Show the summary in the language the claim was written in.
const snippetFor = (item) =>
  item.detected_language === "hi" && item.explanation_snippet_hi
    ? item.explanation_snippet_hi
    : item.explanation_snippet;

export default function CommunityFactChecks({ onOpenReport, refreshKey }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("recent");
  const [pendingIds, setPendingIds] = useState([]);
  const [challengeId, setChallengeId] = useState(null);
  const [challengedIds, setChallengedIds] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [openError, setOpenError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchCommunityClaims(page, PAGE_SIZE, sort)
      .then((data) => {
        if (!cancelled) {
          setError("");
          setResult({ ...data, sort });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [page, sort, refreshKey, retry]);

  const loading =
    !error && (!result || result.page !== page || result.sort !== sort);

  function changePage(next) {
    setError("");
    setChallengeId(null);
    setPage(next);
  }

  function changeSort(next) {
    if (next === sort) return;
    setError("");
    setChallengeId(null);
    setPage(1);
    setSort(next);
  }

  function retryLoad() {
    setError("");
    setRetry((n) => n + 1);
  }

  async function handleOpen(id) {
    setOpenError("");
    try {
      await onOpenReport(id);
    } catch (err) {
      setOpenError(err.message || "Could not open this report.");
    }
  }

  function patchItem(id, patch) {
    setResult((prev) =>
      prev && {
        ...prev,
        items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }
    );
  }

  // "I have seen this too" / undo. The count updates immediately and is
  // corrected (or rolled back) when the server answers.
  async function toggleSeen(item) {
    if (pendingIds.includes(item.id)) return;

    const nextSeen = !item.seen_by_me;
    setOpenError("");
    setPendingIds((ids) => [...ids, item.id]);
    patchItem(item.id, {
      seen_by_me: nextSeen,
      seen_count: Math.max(0, item.seen_count + (nextSeen ? 1 : -1)),
    });

    try {
      const state = await (nextSeen ? markClaimSeen : unmarkClaimSeen)(item.id);
      patchItem(item.id, { seen_by_me: state.seen_by_me, seen_count: state.seen_count });
    } catch (err) {
      patchItem(item.id, { seen_by_me: item.seen_by_me, seen_count: item.seen_count });
      setOpenError(err.message || "Could not update your response.");
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== item.id));
    }
  }

  function handleChallengeSubmitted(id) {
    setChallengedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setChallengeId(null);
  }

  const items = result?.items || [];

  return (
    <section className="cfc-section">
      <div className="cfc-header">
        <div className="kicker">COMMUNITY</div>
        <h2>Community Fact-Checks</h2>
        <p>
          Claims recently investigated by TruthLens users. See what is
          circulating and what the evidence says.
        </p>
      </div>

      <div className="cfc-toolbar" role="group" aria-label="Sort fact-checks">
        <span>Sort by</span>
        {SORT_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`cfc-sort${sort === option.value ? " active" : ""}`}
            aria-pressed={sort === option.value}
            onClick={() => changeSort(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {openError && <div className="cfc-error">{openError}</div>}

      {error && (
        <div className="cfc-error">
          {error} <button onClick={retryLoad}>Try again</button>
        </div>
      )}

      {loading && <div className="cfc-empty">Loading fact-checks…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="cfc-empty">
          No fact-checks yet. Analyze a claim and it will appear here.
        </div>
      )}

      <div className="cfc-list">
        {items.map((item) => (
          <article className="cfc-card" key={item.id}>
            <div className="cfc-card-top">
              <span className={`cfc-badge ${verdicts[item.verdict]?.tone || "unverified"}`}>
                {verdicts[item.verdict]?.label || item.verdict}
              </span>
              {item.zombie_suspected && (
                <span className="cfc-badge recycled">↻ Possibly recycled</span>
              )}
              {item.analysis_count > 1 && (
                <span className="cfc-badge count">
                  Checked {item.analysis_count} times
                </span>
              )}
              <span
                className="cfc-time"
                title={new Date(item.last_analyzed_at).toLocaleString()}
              >
                {timeAgo(item.last_analyzed_at)}
              </span>
            </div>

            <p className="cfc-claim">{item.claim}</p>
            {snippetFor(item) && <p className="cfc-snippet">{snippetFor(item)}</p>}

            <div className="cfc-footer">
              <span>
                Consensus score:{" "}
                <strong>{item.consensus_score ?? "—"}</strong>
                {item.consensus_score != null && "/100"}
              </span>
              <div className="cfc-actions">
                <button
                  type="button"
                  className={`cfc-seen${item.seen_by_me ? " active" : ""}`}
                  aria-pressed={item.seen_by_me}
                  disabled={pendingIds.includes(item.id)}
                  title={
                    item.seen_by_me
                      ? "Click to undo"
                      : "Let others know you have come across this claim too"
                  }
                  onClick={() => toggleSeen(item)}
                >
                  <span aria-hidden="true">{item.seen_by_me ? "✓" : "👁"}</span>
                  {item.seen_by_me ? "You have seen this too" : "I have seen this too"}
                  <span className="cfc-seen-count">{item.seen_count}</span>
                </button>
                <button
                  type="button"
                  className="cfc-challenge"
                  aria-expanded={challengeId === item.id}
                  onClick={() => setChallengeId(challengeId === item.id ? null : item.id)}
                >
                  Challenge
                </button>
                <button className="cfc-open" onClick={() => handleOpen(item.id)}>
                  View full report →
                </button>
              </div>
            </div>

            {challengeId === item.id && (
              <ChallengeForm
                claim={item}
                onCancel={() => setChallengeId(null)}
                onSubmitted={() => handleChallengeSubmitted(item.id)}
              />
            )}
            {challengeId !== item.id && challengedIds.includes(item.id) && (
              <p className="cfc-success" role="status">
                ✓ Thanks, your challenge was submitted. We may contact you at the
                email you gave.
              </p>
            )}
          </article>
        ))}
      </div>

      {result && result.total_pages > 1 && (
        <div className="cfc-pagination">
          <button disabled={page <= 1} onClick={() => changePage(page - 1)}>
            ← Previous
          </button>
          <span>
            Page {result.page} of {result.total_pages}
          </span>
          <button
            disabled={page >= result.total_pages}
            onClick={() => changePage(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}