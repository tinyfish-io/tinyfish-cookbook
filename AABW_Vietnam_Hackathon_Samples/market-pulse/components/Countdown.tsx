"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "due now";
  const totalMins = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export default function Countdown({ targetIso }: { targetIso: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  if (!targetIso) return <span>not scheduled yet</span>;
  const remaining = new Date(targetIso).getTime() - now;
  return <span className="tabular">{formatRemaining(remaining)}</span>;
}
