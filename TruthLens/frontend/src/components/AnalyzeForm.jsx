import AnalysisProgress from "./AnalysisProgress";

export default function AnalyzeForm({
  claim,
  onClaimChange,
  loading,
  progress,
  error,
  onSubmit,
}) {
  return (
    <>
      <section className="card analyzer">
        <div>
          <div className="kicker">START YOUR INVESTIGATION</div>
          <h2>What would you like to verify?</h2>
        </div>

        <form onSubmit={onSubmit}>
          <label className="kicker" htmlFor="claim-input">
            CLAIM OR STATEMENT
          </label>
          <textarea
            id="claim-input"
            value={claim}
            onChange={(event) => onClaimChange(event.target.value)}
            placeholder="Paste a news headline, social media post, or claim, in English, हिंदी or Hinglish..."
            maxLength={2000}
            rows={4}
          />
          <div className="input-meta">
            <span>Be specific for more useful results.</span>
            <span className="mono">{claim.length}/2000</span>
          </div>

          <div className="form-bottom">
            <span className="auto-language">
              Language is detected automatically: English, हिंदी or Hinglish.
            </span>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Analyzing claim...
                </>
              ) : (
                "Analyze claim ↗"
              )}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <b>!</b> {error}
        </div>
      )}

      {loading && <AnalysisProgress progress={progress} />}
    </>
  );
}
