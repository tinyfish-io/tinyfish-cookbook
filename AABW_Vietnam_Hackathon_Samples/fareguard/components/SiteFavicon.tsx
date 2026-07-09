"use client";

import { useState } from "react";
import { SITE_COLORS, SITE_INITIALS } from "@/lib/siteColors";

export default function SiteFavicon({
  siteId,
  domain,
  size = 32,
}: {
  siteId: string;
  domain: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const color = SITE_COLORS[siteId];

  if (failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-[10px] font-medium shrink-0"
        style={{ width: size, height: size, background: `${color}22`, color }}
      >
        {SITE_INITIALS[siteId]}
      </div>
    );
  }

  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center bg-white border border-border shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Pulls each site's own publicly-served favicon at render time —
          not a reproduced/stored brand asset, same as a browser tab icon. */}
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
