/* eslint-disable @next/next/no-img-element */
'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WingSpot } from '@/lib/types';

interface ScoutingReportCardProps {
  spot: WingSpot;
  rank: number;
  isSelected?: boolean;
  onSelect?: (spot: WingSpot) => void;
}

function getStatusColor(status: WingSpot['status']) {
  if (status === 'green') return 'border-green-500 bg-green-950/20';
  if (status === 'yellow') return 'border-yellow-500 bg-yellow-950/20';
  return 'border-red-500 bg-red-950/20';
}

function getStatusLabel(status: WingSpot['status']) {
  if (status === 'green') return { label: 'OPEN', color: 'text-green-400' };
  if (status === 'yellow') return { label: 'LIMITED', color: 'text-yellow-400' };
  return { label: 'CLOSED', color: 'text-red-400' };
}

export function ScoutingReportCard({ spot, rank, isSelected, onSelect }: ScoutingReportCardProps) {
  const statusInfo = getStatusLabel(spot.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      onClick={() => onSelect?.(spot)}
      className={cn(
        'relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-200',
        'bg-gray-900 hover:bg-gray-800',
        getStatusColor(spot.status),
        isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-black'
      )}
    >
      {/* Rank badge */}
      <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
        #{rank}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-white text-sm font-bold truncate">{spot.name}</h3>
          <p className="text-gray-400 text-xs truncate mt-0.5">{spot.address}</p>
        </div>
        <span className={cn('text-xs font-bold shrink-0', statusInfo.color)}>
          {statusInfo.label}
        </span>
      </div>

      {/* Image */}
      {spot.imageUrl && (
        <div className="w-full h-24 rounded-lg overflow-hidden mb-3 bg-gray-800">
          <img
            src={spot.imageUrl}
            alt={spot.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        {spot.rating && (
          <span className="flex items-center gap-1">
            ⭐ <span className="text-white font-semibold">{spot.rating.toFixed(1)}</span>
          </span>
        )}
        {spot.deliveryTime && (
          <span>🕐 {spot.deliveryTime}</span>
        )}
        {spot.deliveryFee && (
          <span>🛵 {spot.deliveryFee}</span>
        )}
        {spot.priceRange && (
          <span>{spot.priceRange}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{spot.siteName}</span>
        {spot.sourceUrl && (
          <a
            href={spot.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Order →
          </a>
        )}
      </div>
    </motion.div>
  );
}
