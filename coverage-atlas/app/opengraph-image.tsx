import { ImageResponse } from "next/og"

// The link preview card. Rendered at build time into a static PNG, so a shared
// URL carries the product name and the mark instead of a bare domain.
export const alt = "Coverage Atlas — Medicaid coverage policy across all 50 states"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const MARK = "data:image/png;base64,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"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f8fa",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK} width={88} height={88} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 600, color: "#172033", letterSpacing: -0.5 }}>Coverage Atlas</div>
            <div style={{ fontSize: 22, color: "#667085" }}>Medicaid policy intelligence</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 60, fontWeight: 600, color: "#172033", lineHeight: 1.1, letterSpacing: -1.5 }}>
            Name a condition.
          </div>
          <div style={{ fontSize: 60, fontWeight: 600, color: "#2457a7", lineHeight: 1.1, letterSpacing: -1.5 }}>
            See all fifty states.
          </div>
          <div style={{ fontSize: 26, color: "#667085", lineHeight: 1.4, maxWidth: 880 }}>
            Coverage status is a lie — two states that both say &quot;covered&quot; can be forty friction points apart.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: "#667085" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["#3a7864", "#d1a149", "#b76a45", "#8f5f57", "#c3c8d0"].map((c) => (
              <div key={c} style={{ width: 18, height: 18, borderRadius: 4, background: c }} />
            ))}
          </div>
          <div>51 jurisdictions · live-scanned on TinyFish</div>
        </div>
      </div>
    ),
    size,
  )
}
