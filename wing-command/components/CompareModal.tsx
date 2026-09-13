'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { WingSpot } from '@/lib/types';

interface CompareModalProps {
  spots: WingSpot[];
  isOpen: boolean;
  onClose: () => void;
}

function bestRating(spots: WingSpot[]): number {
  let best = -1;
  spots.forEach((s, i) => {
    if (s.rating != null && (best === -1 || s.rating > (spots[best]?.rating ?? 0))) best = i;
  });
  return best;
}

export function CompareModal({ spots, isOpen, onClose }: CompareModalProps) {
  if (!isOpen || spots.length < 2) return null;

  const bestRatingIdx = bestRating(spots);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-heading text-xl font-bold">COMPARE SPOTS</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${spots.length}, 1fr)` }}>
              {spots.map((spot, i) => (
                <div key={spot.id} className="bg-gray-800 rounded-xl p-4">
                  <h3 className="text-white font-bold text-sm mb-1 truncate">{spot.name}</h3>
                  <p className="text-gray-400 text-xs truncate mb-3">{spot.address}</p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={spot.status === 'green' ? 'text-green-400' : spot.status === 'yellow' ? 'text-yellow-400' : 'text-red-400'}>
                        {spot.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>
                    {spot.rating != null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rating</span>
                        <span className={i === bestRatingIdx ? 'text-green-400 font-bold' : 'text-white'}>
                          ⭐ {spot.rating.toFixed(1)}
                          {i === bestRatingIdx && <span className="text-[9px] ml-1">BEST</span>}
                        </span>
                      </div>
                    )}
                    {spot.deliveryTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Delivery</span>
                        <span className="text-white">{spot.deliveryTime}</span>
                      </div>
                    )}
                    {spot.deliveryFee && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Fee</span>
                        <span className="text-white">{spot.deliveryFee}</span>
                      </div>
                    )}
                    {spot.priceRange && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Price</span>
                        <span className="text-white">{spot.priceRange}</span>
                      </div>
                    )}
                    {spot.phone && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Phone</span>
                        <a href={`tel:${spot.phone}`} className="text-blue-400">{spot.phone}</a>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Source</span>
                      <span className="text-white uppercase">{spot.siteName}</span>
                    </div>
                    {spot.sourceUrl && (
                      <a
                        href={spot.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center mt-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                      >
                        Order Now →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
