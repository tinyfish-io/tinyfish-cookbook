import React, { useEffect, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { useIntelligence, hasPipelineActivity } from '../../context/IntelligenceContext';
import { QUERY_TYPE_LABELS, type QueryType } from '../../lib/api';
import { IntelligenceReport } from './IntelligenceReport';
import { LivePipelinePanel } from './LivePipelinePanel';
import { SourceQualityMeter } from './SourceQualityMeter';

const QUERY_TYPES = Object.keys(QUERY_TYPE_LABELS) as QueryType[];

const PLACEHOLDERS: Record<QueryType, string> = {
  sme_loan: 'Compare uncollateralized SME loan rates — VPBank vs Techcombank',
  regulatory: 'Latest SBV circular on foreign capital limits for fintech',
  competitor: 'Top bubble tea brands by storefront density in District 1',
  real_estate: 'Commercial rent per m² — District 1 HCMC retail',
  mobility: 'GrabFood vs ShopeeFood delivery fees — District 7 HCMC',
  general: 'Market intelligence query for Vietnam expansion',
};

export function AnalysisConsole() {
  const {
    isRunning,
    lastResponse,
    error,
    currentQuery,
    currentQueryType,
    activeStage,
    stageLogs,
    sourcePreflight,
    runQuery,
  } = useIntelligence();
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState<QueryType>('competitor');

  useEffect(() => {
    if (currentQuery) {
      setQuery(currentQuery);
    }
    if (currentQueryType) {
      setQueryType(currentQueryType);
    }
  }, [currentQuery, currentQueryType]);

  const canRun = !isRunning && query.trim().length >= 3;

  const handleRun = () => {
    if (!canRun) return;
    void runQuery(query, queryType);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canRun) {
      handleRun();
    }
  };

  const result = lastResponse?.results[0];
  const showPipeline = isRunning || hasPipelineActivity(stageLogs);
  const lastStatus = lastResponse?.status;

  return (
    <section
      id="analysis-console"
      className="w-full py-24 px-8 bg-fs-ink border-t border-white/5 relative scroll-mt-24"
    >
      <div className="absolute inset-0 gold-grid opacity-10" />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="mb-10">
          <h4 className="font-mono-fs text-fs-gold text-xs uppercase tracking-[0.2em] mb-4">
            Intelligence Console
          </h4>
          <h2 className="font-serif-display text-4xl md:text-5xl text-white tracking-tight leading-[1.1]">
            Structured market intel. <span className="text-fs-gold italic">Honest confidence.</span>
          </h2>
        </div>

        <div className="rounded-xl border border-white/10 bg-fs-night/80 p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={queryType}
              onChange={(e) => setQueryType(e.target.value as QueryType)}
              disabled={isRunning}
              className="md:w-52 bg-black/40 border border-white/20 rounded-lg px-4 py-3 font-mono-fs text-xs text-white focus:outline-none focus:border-fs-gold/50 disabled:opacity-50"
            >
              {QUERY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUERY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
              placeholder={PLACEHOLDERS[queryType]}
              className="flex-1 bg-black/40 border border-white/20 rounded-lg px-4 py-3 font-sans-fs text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-fs-gold/50 disabled:opacity-50"
            />

            <button
              onClick={handleRun}
              disabled={!canRun}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-fs-gold text-fs-ink font-mono-fs text-xs uppercase tracking-widest font-bold rounded-lg hover:bg-fs-gold-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isRunning ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  Run Analysis
                </>
              )}
            </button>
          </div>

          {showPipeline && (
            <div className="space-y-3">
              <div className="font-mono-fs text-[0.65rem] text-fs-gold uppercase tracking-widest">
                {isRunning ? 'Live pipeline trace' : 'Pipeline trace'}
              </div>
              {sourcePreflight && (
                <SourceQualityMeter preflight={sourcePreflight} />
              )}
              <LivePipelinePanel activeStage={activeStage} stageLogs={stageLogs} />
            </div>
          )}

          {(lastResponse || error) && !isRunning && (
            <div className="border-t border-white/10 pt-6">
              {lastStatus === 'insufficient_data' && (
                <div className="mb-6 p-4 rounded-lg border border-fs-red/40 bg-fs-red/10 font-sans-fs text-sm text-fs-red/90">
                  This query did not meet the bar for board-ready intelligence. Review the source trace,
                  coverage gaps, and gap analysis below — do not present KPI cards as verified.
                </div>
              )}
              {currentQuery && (
                <div className="font-mono-fs text-[0.65rem] text-white/40 uppercase tracking-widest mb-6">
                  Query: <span className="text-white/70 normal-case">{currentQuery}</span>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-lg border border-fs-red/30 bg-fs-red/10 font-mono-fs text-sm text-fs-red mb-4">
                  {error}
                </div>
              )}

              {lastResponse && result && (
                <IntelligenceReport
                  result={result}
                  queryType={currentQueryType ?? lastResponse.query_type}
                  status={lastResponse.status}
                  dataQuality={lastResponse.data_quality}
                  analysisText={lastResponse.analysis}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
