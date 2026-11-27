"use client";

import { useState } from "react";

export default function SiteFavicon({ domain, name, size = 28 }: { domain: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 bg-accent-soft text-accent border border-accent/30"
        style={{ width: size, height: size }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="rounded-full overflow-hidden flex items-center justify-center bg-white border border-border shrink-0" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
