"use client";

import { useState } from "react";

// Pulls each bank's own real favicon — same trick browsers use for tab
// icons, not a copy of brand assets sitting in the repo. Falls back to a
// gold monogram if the favicon fails to load.
export function BankLogo({ domain, name, isSponsor }: { domain: string; name: string; isSponsor?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={`h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold ${
          isSponsor ? "bg-gold/20 text-gold" : "bg-white/5 text-muted"
        }`}
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      className="h-5 w-5 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}
