import React from 'react';
import type { SourcePreflight } from '../../lib/api';

const LOW_SIGNAL_HOSTS = [
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'tiktok.com',
  'instagram.com',
  'reddit.com',
  'twitter.com',
  'x.com',
];

export function isLowSignalHost(host: string): boolean {
  const normalized = host.toLowerCase().replace('www.', '');
  return LOW_SIGNAL_HOSTS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`)
  );
}

export function SourceQualityMeter({
  preflight,
  compact = false,
}: {
  preflight: SourcePreflight | null;
  compact?: boolean;
}) {
  if (!preflight) return null;

  const thin = preflight.usable < 2 || preflight.social >= preflight.usable;
  const failed = preflight.status === 'failed' || preflight.usable === 0;

  const panelClass = failed
    ? 'border-fs-red/40 bg-fs-red/10'
    : thin
      ? 'border-amber-500/40 bg-amber-500/10'
      : 'border-fs-cyan/30 bg-fs-cyan/5';

  const label = failed
    ? 'Source layer failed — synthesis unlikely to be board-ready'
    : thin
      ? 'Thin source layer — expect partial or insufficient brief'
      : 'Source layer looks usable — proceeding to synthesis';

  return (
    <div className={`rounded-lg border px-4 py-3 ${panelClass} ${compact ? 'text-xs' : ''}`}>
      <div className="font-mono-fs text-[0.6rem] uppercase tracking-widest text-white/50 mb-2">
        Source preflight (before brief)
      </div>
      <p className="font-sans-fs text-sm text-white/80 mb-3">{label}</p>
      <div className="flex flex-wrap gap-4 font-mono-fs text-[0.65rem] uppercase tracking-wider">
        <span className="text-white/60">
          <span className="text-white/90 tabular-nums">{preflight.discovered}</span> ranked
        </span>
        <span className="text-white/60">
          <span className={`tabular-nums ${preflight.usable >= 2 ? 'text-fs-cyan' : 'text-amber-300'}`}>
            {preflight.usable}
          </span>{' '}
          usable
        </span>
        {preflight.social > 0 && (
          <span className="text-fs-red/80">
            <span className="tabular-nums">{preflight.social}</span> social/video/app-gated
          </span>
        )}
        {preflight.verifiedMetrics != null && (
          <span className="text-white/60">
            <span
              className={`tabular-nums ${preflight.verifiedMetrics > 0 ? 'text-fs-gold' : 'text-fs-red'}`}
            >
              {preflight.verifiedMetrics}
            </span>{' '}
            verified metrics
          </span>
        )}
      </div>
    </div>
  );
}
