import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  runIntelligenceQueryStream,
  type PipelineEvent,
  type QueryResponse,
  type QueryType,
  type SourcePreflight,
} from '../lib/api';

export type PipelineStage = 'search' | 'fetch' | 'preflight' | 'synthesize';

export interface StageLogs {
  search: string[];
  fetch: string[];
  preflight: string[];
  synthesize: string[];
}

interface IntelligenceContextValue {
  isRunning: boolean;
  activeStage: PipelineStage | null;
  currentQuery: string | null;
  currentQueryType: QueryType | null;
  lastResponse: QueryResponse | null;
  error: string | null;
  stageLogs: StageLogs;
  sourcePreflight: SourcePreflight | null;
  runQuery: (query: string, queryType: QueryType) => Promise<void>;
}

const emptyLogs: StageLogs = { search: [], fetch: [], preflight: [], synthesize: [] };

const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);

function stageFromEvent(event: PipelineEvent): PipelineStage | null {
  if (
    event.stage === 'search' ||
    event.stage === 'fetch' ||
    event.stage === 'preflight' ||
    event.stage === 'synthesize'
  ) {
    return event.stage;
  }
  return null;
}

function formatPipelineLog(event: PipelineEvent): string {
  const prefix =
    event.status === 'failed'
      ? '✗'
      : event.status === 'warn'
        ? '⚠'
        : event.status === 'ok'
          ? '✓'
          : '→';
  return `${prefix} ${event.message}`;
}

function preflightFromEvent(event: PipelineEvent): SourcePreflight | null {
  const meta = event.meta;
  if (!meta || typeof meta !== 'object') return null;
  const discovered = Number(meta.discovered);
  const usable = Number(meta.usable);
  const social = Number(meta.social);
  if (Number.isNaN(discovered) && Number.isNaN(usable)) return null;
  return {
    discovered: Number.isNaN(discovered) ? 0 : discovered,
    usable: Number.isNaN(usable) ? 0 : usable,
    social: Number.isNaN(social) ? 0 : social,
    verifiedMetrics:
      meta.verified_metrics != null ? Number(meta.verified_metrics) : undefined,
    status: event.status,
  };
}

function appendPipelineEvent(logs: StageLogs, event: PipelineEvent): StageLogs {
  const stage = stageFromEvent(event);
  if (!stage) return logs;
  return {
    ...logs,
    [stage]: [...logs[stage], formatPipelineLog(event)],
  };
}

export function IntelligenceProvider({ children }: { children: React.ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string | null>(null);
  const [currentQueryType, setCurrentQueryType] = useState<QueryType | null>(null);
  const [lastResponse, setLastResponse] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageLogs, setStageLogs] = useState<StageLogs>(emptyLogs);
  const [sourcePreflight, setSourcePreflight] = useState<SourcePreflight | null>(null);
  const runIdRef = useRef(0);

  const runQuery = useCallback(async (query: string, queryType: QueryType) => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      toast.error('Query must be at least 3 characters.');
      return;
    }

    const runId = ++runIdRef.current;
    setIsRunning(true);
    setError(null);
    setCurrentQuery(trimmed);
    setCurrentQueryType(queryType);
    setLastResponse(null);
    setStageLogs(emptyLogs);
    setSourcePreflight(null);
    setActiveStage('search');

    try {
      const response = await runIntelligenceQueryStream(trimmed, queryType, (event) => {
        if (runIdRef.current !== runId) return;
        const stage = stageFromEvent(event);
        if (stage) setActiveStage(stage);
        setStageLogs((prev) => appendPipelineEvent(prev, event));

        if (event.stage === 'preflight') {
          const snapshot = preflightFromEvent(event);
          if (snapshot) setSourcePreflight(snapshot);
        }

        if (event.stage === 'synthesize' && event.message.includes('verified metric')) {
          const match = event.message.match(/extracted (\d+) verified metric/);
          if (match) {
            setSourcePreflight((prev) =>
              prev
                ? { ...prev, verifiedMetrics: Number(match[1]) }
                : {
                    discovered: 0,
                    usable: 0,
                    social: 0,
                    verifiedMetrics: Number(match[1]),
                    status: event.status,
                  }
            );
          }
        }
      });

      if (runIdRef.current !== runId) return;

      setLastResponse(response);
      setActiveStage(null);

      if (response.data_quality) {
        setSourcePreflight((prev) => ({
          ...prev,
          discovered: response.data_quality!.sources_discovered,
          usable: response.data_quality!.sources_with_content,
          social: response.data_quality!.low_signal_sources,
          verifiedMetrics: response.data_quality!.verified_metrics_count,
          status: response.status,
        }));
      }

      if (response.status === 'success') {
        toast.success('Analysis complete — high-confidence brief.');
      } else if (response.status === 'partial') {
        toast.warning('Partial brief — verify sources before acting.');
      } else if (response.status === 'insufficient_data') {
        toast.error('Insufficient data — not board-ready.');
      } else {
        toast.error(`Analysis finished with status: ${response.status}`);
      }
    } catch (err) {
      if (runIdRef.current !== runId) return;
      const message = err instanceof Error ? err.message : 'Query failed.';
      setError(message);
      setActiveStage(null);
      setStageLogs((prev) => ({
        ...prev,
        synthesize: [...prev.synthesize, `✗ ${message}`],
      }));
      toast.error(message);
    } finally {
      if (runIdRef.current === runId) {
        setIsRunning(false);
      }
    }
  }, []);

  return (
    <IntelligenceContext.Provider
      value={{
        isRunning,
        activeStage,
        currentQuery,
        currentQueryType,
        lastResponse,
        error,
        stageLogs,
        sourcePreflight,
        runQuery,
      }}
    >
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence() {
  const ctx = useContext(IntelligenceContext);
  if (!ctx) {
    throw new Error('useIntelligence must be used within IntelligenceProvider');
  }
  return ctx;
}

export function hasPipelineActivity(logs: StageLogs): boolean {
  return Object.values(logs).some((entries) => entries.length > 0);
}
