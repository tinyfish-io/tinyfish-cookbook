"use client"

import { useState } from "react"
import { ComposableMap, Geographies, Geography } from "react-simple-maps"
import statesTopology from "us-atlas/states-10m.json"
import {
  FRICTION_BANDS,
  STATUS_COLOR,
  STATUS_LABEL,
  frictionColor,
  type CoverageRecord,
  type CoverageStatus,
} from "@/lib/atlas"

export type MapMode = "status" | "friction"

/**
 * The choropleth, with two modes that answer two different questions.
 *
 * Status mode is the map everyone expects. Friction mode is the one that earns
 * the product: it colours by how hard the treatment actually is to obtain, and
 * on most conditions it redraws the country entirely — because a dozen states
 * that all say "covered" are nothing like each other once prior authorization,
 * step therapy and documentation requirements are counted.
 *
 * A colour is never the only carrier of meaning: every state is reachable by
 * keyboard, announces its status in its accessible name, and the matrix view is
 * always one click away.
 */
export function PolicyMap({
  records,
  mode,
  selected,
  onSelect,
  landing,
}: {
  records: CoverageRecord[]
  mode: MapMode
  selected?: string
  onSelect: (record: CoverageRecord) => void
  /** States that arrived in the last moment of a live scan — they animate in. */
  landing?: Set<string>
}) {
  const [hover, setHover] = useState<CoverageRecord | null>(null)
  const byFips = new Map(records.map((r) => [r.fips, r]))

  const legend =
    mode === "status"
      ? (Object.keys(STATUS_LABEL) as CoverageStatus[]).map((s) => [STATUS_LABEL[s], STATUS_COLOR[s]] as const)
      : FRICTION_BANDS

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
        {legend.map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      <div className="relative">
        <ComposableMap
          projection="geoAlbersUsa"
          width={800}
          height={500}
          className="h-auto w-full"
          aria-label={`United States Medicaid coverage map, coloured by ${mode === "status" ? "coverage status" : "access friction"}`}
        >
          <Geographies geography={statesTopology}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const record = byFips.get(String(geo.id))
                if (!record) return null
                const fill = mode === "status" ? STATUS_COLOR[record.status] : frictionColor(record.frictionIndex)
                const isSelected = selected === record.state
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onSelect(record)}
                    onMouseEnter={() => setHover(record)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(record)}
                    onBlur={() => setHover(null)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onSelect(record)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${record.stateName}: ${STATUS_LABEL[record.status]}, access friction ${record.frictionIndex} of 100`}
                    className={landing?.has(record.state) ? "atlas-land" : undefined}
                    fill={fill}
                    stroke={isSelected ? "var(--foreground)" : "var(--background)"}
                    strokeWidth={isSelected ? 2 : 0.75}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", cursor: "pointer", filter: "brightness(1.12)" },
                      pressed: { outline: "none" },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>

        {hover && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-64 rounded-md border bg-card/95 p-3 shadow-sm backdrop-blur">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{hover.stateName}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{hover.state}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-sm" style={{ background: STATUS_COLOR[hover.status] }} />
              {STATUS_LABEL[hover.status]}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Access friction</span>
              <span className="font-semibold text-foreground">{hover.frictionIndex}/100</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${hover.frictionIndex}%`, background: frictionColor(hover.frictionIndex) }} />
            </div>
            {hover.frictionFlags.length > 0 && (
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                {hover.frictionFlags.length} documented gate{hover.frictionFlags.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Select a state for criteria, verbatim policy language, source evidence, and a live re-check.
      </p>
    </div>
  )
}
