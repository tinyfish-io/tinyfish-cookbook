"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import { RateListing } from "@/lib/types";
import { formatPercent, formatVND, formatTimeAgo } from "@/lib/formatters";
import { BankLogo } from "./BankLogo";

export function BankDetailModal({ listing, onClose }: { listing: RateListing | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {listing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="glass bg-panel border border-gold/30 rounded-xl p-6 max-w-sm w-full"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <BankLogo domain={listing.domain} name={listing.bankName} isSponsor={listing.isSponsor} />
                <div>
                  <div className={`text-base font-semibold ${listing.isSponsor ? "text-gold" : "text-paper"}`}>
                    {listing.bankName}
                  </div>
                  <div className="text-[11px] text-muted">{listing.domain}</div>
                </div>
              </div>
              <button onClick={onClose} className="text-muted hover:text-paper">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm border-t border-line pt-4">
              <Row label="Rate" value={listing.ratePercent !== undefined ? formatPercent(listing.ratePercent) : "—"} highlight />
              <Row
                label="Minimum amount"
                value={listing.minAmountVND ? formatVND(listing.minAmountVND) : "—"}
              />
              <Row label="Data source" value={listing.source === "internal" ? "Internal feed (Shinhan)" : "Live agent"} />
              <Row label="Checked" value={formatTimeAgo(listing.checkedAt)} />
              <Row label="Status" value={listing.live ? "Live" : "Simulated (fallback)"} />
            </div>

            <a
              href={`https://${listing.domain}`}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex items-center justify-center gap-2 bg-primary text-paper text-sm font-medium py-2.5 rounded-lg hover:bg-primary/80 transition border border-gold/30"
            >
              Visit {listing.bankName} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={highlight ? "text-gold font-semibold" : "text-paper/85"}>{value}</span>
    </div>
  );
}
