export type QueryType =
  | 'sme_loan'
  | 'regulatory'
  | 'competitor'
  | 'real_estate'
  | 'mobility'
  | 'general';

export interface MetricItem {
  label: string;
  value: string;
  unit?: string | null;
  change?: string | null;
}

export interface StructuredReport {
  headline: string;
  executive_summary: string;
  intelligence_brief: string;
  key_findings: string[];
  metrics: MetricItem[];
  comparison_table: Record<string, string>[];
  recommendation: string;
  data_as_of?: string | null;
  caveats: string[];
}

export interface IntelligenceResult {
  title: string;
  summary: string;
  structured?: StructuredReport | null;
  source_urls: string[];
  confidence_score?: number;
}

export interface QueryResponse {
  status: string;
  results: IntelligenceResult[];
  analysis: string;
  query_type?: QueryType;
  data_quality?: DataQuality | null;
  pipeline?: PipelineEvent[];
}

export interface PipelineEvent {
  stage: string;
  message: string;
  url?: string | null;
  status?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface SourcePreflight {
  discovered: number;
  usable: number;
  social: number;
  verifiedMetrics?: number;
  status?: string | null;
}

export interface DataQuality {
  score: number;
  tier: 'high' | 'medium' | 'low' | 'insufficient';
  sources_discovered: number;
  sources_fetched: number;
  sources_with_content: number;
  weak_metrics_count: number;
  low_signal_sources: number;
  verified_metrics_count: number;
  coverage_gaps: string[];
  reasons: string[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export const DRAWER_QUERY_TYPES: Record<string, QueryType> = {
  'market-intel': 'competitor',
  'sme-finance': 'sme_loan',
  regulatory: 'regulatory',
};

export const QUERY_TYPE_LABELS: Record<QueryType, string> = {
  sme_loan: 'SME Finance',
  regulatory: 'Regulatory',
  competitor: 'Competitor Intel',
  real_estate: 'Real Estate',
  mobility: 'Mobility',
  general: 'General',
};

function getApiBase(): string {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase && typeof envBase === 'string' && envBase.length > 0) {
    return envBase.replace(/\/$/, '');
  }
  return '';
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

export async function runIntelligenceQuery(
  query: string,
  queryType: QueryType
): Promise<QueryResponse> {
  const res = await fetch(apiUrl('/api/v1/intelligence/query'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, query_type: queryType }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | ApiError
      | { detail?: string }
      | null;
    const message =
      (body && 'error' in body && body.error?.message) ||
      (body && 'detail' in body && typeof body.detail === 'string' ? body.detail : null) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<QueryResponse>;
}

type StreamMessage =
  | { type: 'pipeline'; data: PipelineEvent }
  | { type: 'result'; data: QueryResponse }
  | { type: 'error'; data: { message: string } };

function parseSseChunk(buffer: string): { events: StreamMessage[]; rest: string } {
  const events: StreamMessage[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';

  for (const part of parts) {
    const line = part
      .split('\n')
      .find((entry) => entry.startsWith('data: '));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(6)) as StreamMessage);
    } catch {
      // ignore malformed chunks
    }
  }

  return { events, rest };
}

export async function runIntelligenceQueryStream(
  query: string,
  queryType: QueryType,
  onPipelineEvent: (event: PipelineEvent) => void
): Promise<QueryResponse> {
  const res = await fetch(apiUrl('/api/v1/intelligence/query/stream'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ query, query_type: queryType }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | ApiError
      | { detail?: string }
      | null;
    const message =
      (body && 'error' in body && body.error?.message) ||
      (body && 'detail' in body && typeof body.detail === 'string' ? body.detail : null) ||
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error('Streaming response not supported in this browser.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.rest;

    for (const message of parsed.events) {
      if (message.type === 'pipeline') {
        onPipelineEvent(message.data);
      } else if (message.type === 'error') {
        throw new Error(message.data.message);
      } else if (message.type === 'result') {
        return message.data;
      }
    }
  }

  throw new Error('Stream ended before a result was returned.');
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function formatStructuredJson(report: StructuredReport): string {
  return JSON.stringify(
    {
      headline: report.headline,
      executive_summary: report.executive_summary,
      intelligence_brief: report.intelligence_brief,
      metrics: report.metrics,
      comparison_table: report.comparison_table,
      key_findings: report.key_findings,
      recommendation: report.recommendation,
      data_as_of: report.data_as_of,
    },
    null,
    2
  );
}
