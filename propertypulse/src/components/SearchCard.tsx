"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Building2, User, Clock } from "lucide-react";
import type { TrackedSearch } from "@/lib/types";
import { relativeTime } from "@/lib/format";

export default function SearchCard({ search }: { search: TrackedSearch }) {
  const Icon = search.propertyType === "house" ? Home : Building2;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link href={`/search/${search.id}`} className="card-surface rounded-xl p-5 block">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center">
            <Icon size={16} className="text-accent" />
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-alt text-text-secondary uppercase tracking-wide">
            {search.intent === "rent" ? "For rent" : "For sale"}
          </span>
        </div>
        <p className="text-sm font-medium mb-1">{search.area}</p>
        <p className="text-xs text-text-muted mb-3 capitalize">{search.propertyType}</p>
        {search.clientName && (
          <p className="text-[11px] text-text-secondary flex items-center gap-1 mb-2">
            <User size={11} /> {search.clientName}
          </p>
        )}
        <p className="text-[11px] text-text-muted flex items-center gap-1">
          <Clock size={11} /> {search.lastSweptAt ? `Checked ${relativeTime(search.lastSweptAt)}` : "Not checked yet"}
        </p>
      </Link>
    </motion.div>
  );
}
