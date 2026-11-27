import { useEffect, useReducer, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { analyzeClaimStream, fetchCommunityReport } from "./api";
import { initialProgress, progressReducer } from "./progress";
import Navbar from "./components/Navbar";
import About from "./components/About";
import AnalyzeForm from "./components/AnalyzeForm";
import Results from "./components/Results";
import CommunityFactChecks from "./components/CommunityFactChecks";

// Start every page at the top when the route changes.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const navigate = useNavigate();
  const [claim, setClaim] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [progress, dispatchProgress] = useReducer(progressReducer, initialProgress);
  const abortRef = useRef(null);

  // Cancel any in-flight analysis when the app unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleAnalyze(event) {
    event?.preventDefault();

    if (!claim.trim()) {
      setError("Enter a claim before starting the analysis.");
      return;
    }

    setError("");
    setAnalysis(null);
    setSelectedSegment(null);
    dispatchProgress({ stage: "reset" });
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const report = await analyzeClaimStream(
        claim,
        dispatchProgress,
        controller.signal
      );
      setAnalysis(report);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }

  // Opens a stored community report in the Analyze view (no re-analysis).
  async function openCommunityReport(id) {
    const data = await fetchCommunityReport(id);
    setClaim(data.claim);
    setAnalysis(data);
    setError("");
    setSelectedSegment(null);
    navigate("/analyze");
    setTimeout(() => {
      document
        .querySelector(".results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  return (
    <div className="app-shell">
      <ScrollToTop />
      <Navbar />

      <main className="page">
        <Routes>
          <Route path="/" element={<About />} />
          <Route
            path="/analyze"
            element={
              <>
                <AnalyzeForm
                  claim={claim}
                  onClaimChange={(value) => {
                    setClaim(value);
                    setError("");
                  }}
                  loading={loading}
                  progress={progress}
                  error={error}
                  onSubmit={handleAnalyze}
                />
                {analysis && !loading && (
                  <Results
                    key={analysis.analysis_id || analysis.claim}
                    analysis={analysis}
                    selected={selectedSegment}
                    onSelect={setSelectedSegment}
                    onClear={() => {
                      setAnalysis(null);
                      setError("");
                    }}
                  />
                )}
              </>
            }
          />
          <Route
            path="/community"
            element={
              <CommunityFactChecks
                onOpenReport={openCommunityReport}
                refreshKey={analysis?.analysis_id}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <footer className="footer">
          <span>© 2026 TruthLens</span>
          <span>Evidence first. Clarity always.</span>
        </footer>
      </main>
    </div>
  );
}
