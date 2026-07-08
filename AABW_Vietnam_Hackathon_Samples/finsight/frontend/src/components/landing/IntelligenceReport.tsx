import React from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { DataQuality, IntelligenceResult, QueryType } from '../../lib/api';
import { QUERY_TYPE_LABELS } from '../../lib/api';
import { MarkdownContent } from '../MarkdownContent';
import { isLowSignalHost } from './SourceQualityMeter';

interface IntelligenceReportProps {
  result: IntelligenceResult;
  queryType?: QueryType | null;
  status: string;
  dataQuality?: DataQuality | null;
  analysisText?: string | null;
  compact?: boolean;
}

function formatColumnHeader(key: string): string {
  const labels: Record<string, string> = {
    entity: 'Entity',
    primary_metric: 'Primary',
    secondary_metric: 'Secondary',
    notes: 'Desk Notes',
    rate: 'Rate',
    term: 'Term',
    price_vnd: 'Price (VND)',
    rent: 'Rent',
    district: 'District',
    regulation: 'Regulation',
    cap_or_limit: 'Cap / Limit',
    status: 'Status',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function tierLabel(tier?: string): string {
  switch (tier) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence';
    case 'insufficient':
      return 'Insufficient data';
    default:
      return 'Unverified';
  }
}

function tierStyles(tier?: string, status?: string) {
  if (status === 'insufficient_data' || tier === 'insufficient') {
    return {
      badge: 'bg-fs-red/15 text-fs-red border-fs-red/40',
      panel: 'border-fs-red/30 bg-fs-red/10',
      icon: ShieldAlert,
    };
  }
  if (status === 'partial' || tier === 'low' || tier === 'medium') {
    return {
      badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      panel: 'border-amber-500/30 bg-amber-500/10',
      icon: ShieldQuestion,
    };
  }
  return {
    badge: 'bg-fs-cyan/15 text-fs-cyan border-fs-cyan/30',
    panel: 'border-fs-cyan/25 bg-fs-cyan/5',
    icon: ShieldCheck,
  };
}

function isWeakMetricValue(value: string): boolean {
  const text = value.trim().toLowerCase();
  return (
    !text ||
    text === 'unknown' ||
    text === 'variable' ||
    text.includes('unknown vnd') ||
    text.includes('variable vnd') ||
    text === 'n/a'
  );
}

export function IntelligenceReport({
  result,
  queryType,
  status,
  dataQuality,
  analysisText,
  compact = false,
}: IntelligenceReportProps) {
  const report = result.structured;
  const tier = dataQuality?.tier;
  const styles = tierStyles(tier, status);
  const StatusIcon = styles.icon;
  const isInsufficient = status === 'insufficient_data' || tier === 'insufficient';
  const isPartial = status === 'partial' || tier === 'low' || tier === 'medium';
  const showMetricSections = !isInsufficient;
  const showRecommendation = !isInsufficient && !isPartial;

  if (!report) {
    return (
      <div className="p-5 rounded-lg bg-black/40 border border-white/10">
        <MarkdownContent variant="body">{result.summary}</MarkdownContent>
      </div>
    );
  }

  const tableColumns =
    report.comparison_table.length > 0
      ? Object.keys(report.comparison_table[0])
      : [];

  const sectionGap = compact ? 'space-y-4' : 'space-y-6';

  return (
    <div className={`${sectionGap} ${compact ? '' : 'mt-1'}`}>
      <div className={`rounded-xl border p-5 ${styles.panel}`}>
        <div className="flex items-start gap-3">
          <StatusIcon size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {queryType && (
                <span className="px-2.5 py-1 rounded font-mono-fs text-[0.6rem] uppercase tracking-widest bg-white/5 text-white/70 border border-white/10">
                  {QUERY_TYPE_LABELS[queryType]}
                </span>
              )}
              <span className={`px-2.5 py-1 rounded font-mono-fs text-[0.6rem] uppercase tracking-widest border ${styles.badge}`}>
                {isInsufficient ? 'Insufficient data' : isPartial ? 'Partial brief' : 'Board-ready brief'}
              </span>
              {isInsufficient ? (
                <span className="font-mono-fs text-[0.6rem] text-fs-red/80 uppercase tracking-widest">
                  Not board-ready
                </span>
              ) : result.confidence_score != null ? (
                <span className="font-mono-fs text-[0.6rem] text-white/50">
                  {tierLabel(tier)} · {(result.confidence_score * 100).toFixed(0)}%
                </span>
              ) : null}
            </div>
            <p className="font-sans-fs text-sm text-white/80 leading-relaxed">
              {isInsufficient
                ? 'Source layer was too thin or placeholder-heavy for a trustworthy desk memo. Do not present this as verified market intelligence.'
                : isPartial
                  ? 'Some signals were recovered, but key pricing fields are weak. Treat findings as directional only until corroborated.'
                  : 'Structured brief generated from verified source extraction with strong field coverage.'}
            </p>
            {dataQuality && (
              <div className="flex flex-wrap gap-3 font-mono-fs text-[0.62rem] text-white/45 uppercase tracking-wider">
                <span>{dataQuality.sources_discovered} discovered</span>
                <span>{dataQuality.sources_with_content} usable</span>
                {dataQuality.weak_metrics_count > 0 && (
                  <span>{dataQuality.weak_metrics_count} weak KPIs</span>
                )}
                {dataQuality.low_signal_sources > 0 && (
                  <span>{dataQuality.low_signal_sources} social/video sources</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {dataQuality?.coverage_gaps?.length ? (
        <div className="rounded-lg border border-fs-red/25 bg-fs-red/5 p-4 space-y-2">
          <div className="font-mono-fs text-[0.6rem] text-fs-red/70 uppercase tracking-widest">
            Coverage gaps
          </div>
          <ul className="space-y-1.5">
            {dataQuality.coverage_gaps.map((gap, i) => (
              <li key={i} className="font-sans-fs text-sm text-white/70 leading-relaxed">
                {gap}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dataQuality?.reasons?.length ? (
        <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-2">
          <div className="font-mono-fs text-[0.6rem] text-white/40 uppercase tracking-widest">
            Data quality flags
          </div>
          <ul className="space-y-1.5">
            {dataQuality.reasons.map((reason, i) => (
              <li key={i} className="font-mono-fs text-[0.68rem] text-white/55 leading-relaxed">
                • {reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="font-serif-display text-2xl md:text-3xl text-white leading-snug">
          {report.headline || result.title}
        </h3>
      </div>

      {report.executive_summary && (
        <div className={`px-5 py-4 rounded-xl border-l-2 ${isInsufficient ? 'border-fs-red/60 bg-fs-red/5' : isPartial ? 'border-amber-500/60 bg-amber-500/5' : 'border-fs-gold bg-fs-gold/5'}`}>
          <div className="font-mono-fs text-[0.6rem] uppercase tracking-widest mb-3 text-white/50">
            {isInsufficient ? 'Limited summary' : 'Desk summary'}
          </div>
          <MarkdownContent variant="compact">{report.executive_summary}</MarkdownContent>
        </div>
      )}

      {report.intelligence_brief && (
        <div className={`px-5 py-5 rounded-xl border ${isInsufficient ? 'border-fs-red/25 bg-fs-red/5' : 'border-white/10 bg-black/25'}`}>
          <div className={`font-mono-fs text-[0.6rem] uppercase tracking-widest mb-4 ${isInsufficient ? 'text-fs-red/80' : 'text-fs-gold'}`}>
            {isInsufficient ? 'Gap analysis & available signals' : 'Intelligence Brief'}
          </div>
          <MarkdownContent variant="brief">{report.intelligence_brief}</MarkdownContent>
        </div>
      )}

      {!compact && analysisText && analysisText.trim() && analysisText !== report.intelligence_brief && (
        <div className="px-5 py-5 rounded-xl border border-white/10 bg-black/25">
          <div className="font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest mb-4">
            Extended Analysis
          </div>
          <MarkdownContent variant="body">{analysisText}</MarkdownContent>
        </div>
      )}

      {showMetricSections && report.metrics.length > 0 && (
        <div className="space-y-3">
          <div className="font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest">
            Key Metrics
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {report.metrics.map((m, i) => {
              const weak = isWeakMetricValue(m.value);
              return (
                <div
                  key={i}
                  className={`p-4 rounded-lg border ${weak ? 'border-fs-red/30 bg-fs-red/5' : 'border-white/10 bg-black/30'}`}
                >
                  <div className="font-mono-fs text-[0.55rem] text-white/40 uppercase tracking-widest mb-2.5 truncate">
                    {m.label}
                  </div>
                  <div className={`font-serif-display text-xl leading-tight ${weak ? 'text-fs-red line-through decoration-fs-red/50' : 'text-fs-gold'}`}>
                    {m.value}
                    {m.unit && (
                      <span className="font-mono-fs text-[0.65rem] text-white/50 ml-1.5">
                        {m.unit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showMetricSections && report.comparison_table.length > 0 && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-white/5 border-b border-white/10 font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest">
            Comparative Desk View
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  {tableColumns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 font-mono-fs text-[0.6rem] text-white/40 uppercase tracking-wider whitespace-nowrap"
                    >
                      {formatColumnHeader(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.comparison_table.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    {tableColumns.map((col) => (
                      <td
                        key={col}
                        className={`px-4 py-3.5 font-sans-fs text-sm ${
                          col === 'entity'
                            ? 'text-white font-medium whitespace-nowrap'
                            : isWeakMetricValue(row[col] || '')
                              ? 'text-fs-red/80 line-through'
                              : 'text-white/75'
                        }`}
                      >
                        {row[col] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report.key_findings.length > 0 && (
        <div className="space-y-3">
          <div className="font-mono-fs text-[0.6rem] text-fs-gold uppercase tracking-widest">
            Key Findings
          </div>
          <ul className="space-y-3">
            {report.key_findings.map((finding, i) => (
              <li
                key={i}
                className="flex gap-4 px-4 py-3 rounded-lg border border-white/5 bg-black/20"
              >
                <span className="text-fs-gold font-mono-fs text-xs mt-0.5 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <MarkdownContent variant="compact">{finding}</MarkdownContent>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showRecommendation && report.recommendation && (
        <div className="flex gap-4 p-5 rounded-xl border border-fs-cyan/25 bg-fs-cyan/5">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="font-mono-fs text-[0.6rem] text-fs-cyan uppercase tracking-widest">
              Desk Recommendation
            </div>
            <MarkdownContent variant="body">{report.recommendation}</MarkdownContent>
          </div>
        </div>
      )}

      {report.caveats.length > 0 && (
        <div className="flex gap-3 px-4 py-3 rounded-lg border border-white/10 bg-black/20">
          <AlertTriangle size={14} className="text-white/40 shrink-0 mt-0.5" />
          <ul className="space-y-1.5">
            {report.caveats.map((c, i) => (
              <li key={i} className="font-mono-fs text-[0.65rem] text-white/45 leading-relaxed">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.source_urls.length > 0 && (
        <div className="pt-4 border-t border-white/10 space-y-2.5">
          <div className="font-mono-fs text-[0.6rem] text-white/30 uppercase tracking-widest">
            Sources ({result.source_urls.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {result.source_urls.map((url) => {
              let host = url;
              let lowSignal = false;
              try {
                host = new URL(url).hostname.replace('www.', '');
                lowSignal = isLowSignalHost(host);
              } catch {}
              return (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={lowSignal ? 'Social/video or weak signal source' : 'Editorial or data source'}
                  className={`px-2.5 py-1 rounded-full border font-mono-fs text-[0.6rem] transition-colors ${
                    lowSignal
                      ? 'border-fs-red/30 text-fs-red/80 hover:border-fs-red/50'
                      : 'border-white/10 text-fs-cyan hover:border-fs-gold/40 hover:text-fs-gold'
                  }`}
                >
                  {host}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
