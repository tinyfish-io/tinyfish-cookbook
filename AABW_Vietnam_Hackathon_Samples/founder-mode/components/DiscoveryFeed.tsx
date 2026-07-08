"use client";

import { useState, type RefObject } from "react";
import { motion, type PanInfo } from "framer-motion";
import { MapPin, Clock, GripVertical } from "lucide-react";
import type { Program } from "@/lib/types";
import { formatDeadline } from "@/lib/format";

const TYPE_COLOR: Record<Program["type"], string> = {
  Accelerator: "var(--accent)",
  Grant: "var(--warning)",
  "VC Residency": "var(--success)",
};

const MAGNET_RADIUS = 160; // px — how close before the drop zone starts "pulling"
const CAPTURE_RADIUS = 70; // px — how close on release counts as a successful drop

function distanceToRect(point: { x: number; y: number }, rect: DOMRect): number {
  // info.point from framer-motion is page-relative (accounts for scroll),
  // but getBoundingClientRect() is viewport-relative (does not) — without
  // this adjustment, the two disagree the moment the page isn't scrolled
  // to the very top, which made the magnet/drop detection silently wrong.
  const left = rect.left + window.scrollX;
  const right = rect.right + window.scrollX;
  const top = rect.top + window.scrollY;
  const bottom = rect.bottom + window.scrollY;
  const cx = Math.max(left, Math.min(point.x, right));
  const cy = Math.max(top, Math.min(point.y, bottom));
  return Math.hypot(point.x - cx, point.y - cy);
}

function ProgramCard({
  program,
  dropZoneRef,
  onMagnetChange,
  onDropProgram,
}: {
  program: Program;
  dropZoneRef: RefObject<HTMLDivElement>;
  onMagnetChange: (active: boolean) => void;
  onDropProgram: (programId: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDrag(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const zone = dropZoneRef.current;
    if (!zone) return;
    const dist = distanceToRect(info.point, zone.getBoundingClientRect());
    onMagnetChange(dist < MAGNET_RADIUS);
  }

  function handleDragEnd(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    setDragging(false);
    onMagnetChange(false);
    const zone = dropZoneRef.current;
    if (!zone) return;
    const dist = distanceToRect(info.point, zone.getBoundingClientRect());
    if (dist < CAPTURE_RADIUS) onDropProgram(program.id);
  }

  return (
    <motion.div
      drag
      dragSnapToOrigin
      dragElastic={0.15}
      whileDrag={{ scale: 1.06, boxShadow: "0 12px 32px rgba(0,0,0,0.35)", zIndex: 50, cursor: "grabbing" }}
      onDragStart={() => setDragging(true)}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className="card-surface rounded-xl p-3.5 cursor-grab select-none relative"
      style={{ touchAction: "none" }}
    >
      <div className="absolute top-2 right-2 text-text-muted opacity-0 group-hover:opacity-100">
        <GripVertical size={13} />
      </div>
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded font-mono"
          style={{ background: `${TYPE_COLOR[program.type]}1A`, color: TYPE_COLOR[program.type] }}
        >
          {program.type.toUpperCase()}
        </span>
        <span
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-medium font-mono"
          style={{ borderColor: "var(--accent)" }}
        >
          {program.matchScore}
        </span>
      </div>
      <p className="text-sm font-medium mb-1">{program.name}</p>
      <p className="text-xs text-text-muted mb-3">{program.fundingSummary}</p>
      <div className="flex items-center justify-between text-[11px] text-text-secondary">
        <span className="flex items-center gap-1">
          <MapPin size={11} /> {program.location}
        </span>
        <span className="flex items-center gap-1 font-mono">
          <Clock size={11} /> {formatDeadline(program.deadline)}
        </span>
      </div>
      {dragging && <p className="text-[10px] text-accent mt-2 text-center">Drag onto the pipeline below</p>}
    </motion.div>
  );
}

export default function DiscoveryFeed({
  programs,
  appliedProgramIds,
  dropZoneRef,
  onMagnetChange,
  onDropProgram,
}: {
  programs: Program[];
  appliedProgramIds: Set<string>;
  dropZoneRef: RefObject<HTMLDivElement>;
  onMagnetChange: (active: boolean) => void;
  onDropProgram: (programId: string) => void;
}) {
  const available = programs.filter((p) => !appliedProgramIds.has(p.id));

  if (available.length === 0) {
    return <p className="text-sm text-text-muted py-8 text-center">No new programs right now — check back after the next sweep.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {available.map((program) => (
        <ProgramCard
          key={program.id}
          program={program}
          dropZoneRef={dropZoneRef}
          onMagnetChange={onMagnetChange}
          onDropProgram={onDropProgram}
        />
      ))}
    </div>
  );
}
