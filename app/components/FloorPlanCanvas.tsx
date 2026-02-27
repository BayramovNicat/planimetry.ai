"use client";

import { useRef, useEffect, useMemo } from "react";
import type { Room } from "../types";
import { normalizeRooms } from "./canvas/normalizeRooms";
import { useCanvasRenderer } from "./canvas/useCanvasRenderer";
import { useCanvasInteraction } from "./canvas/useCanvasInteraction";

interface FloorPlanCanvasProps {
  rooms: Room[];
  highlightIndex: number | null;
  onHoverRoom: (index: number | null) => void;
  activeRoom: number | null;
  onSelectRoom: (index: number | null) => void;
  onMoveRoom: (index: number, bbox: [number, number, number, number]) => void;
  onUpdateRoom?: (index: number, data: Partial<Room>) => void;
  splitMode?: boolean;
  onSplit?: (index: number, orientation: "h" | "v", ratio: number) => void;
  onMergeRooms?: (indexA: number, indexB: number) => void;
}

export function FloorPlanCanvas({
  rooms,
  highlightIndex,
  onHoverRoom,
  activeRoom,
  onSelectRoom,
  onMoveRoom,
  onUpdateRoom,
  splitMode,
  onSplit,
  onMergeRooms,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalized = useMemo(() => normalizeRooms(rooms), [rooms]);

  const { layoutRef, drawRooms } = useCanvasRenderer(canvasRef, containerRef, normalized);

  const { handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } =
    useCanvasInteraction({
      canvasRef,
      normalizedRooms: normalized,
      layoutRef,
      highlightIndex,
      activeRoom,
      splitMode,
      onHoverRoom,
      onSelectRoom,
      onMoveRoom,
      onUpdateRoom,
      onSplit,
      onMergeRooms,
      drawRooms,
    });

  useEffect(() => {
    drawRooms(highlightIndex, activeRoom);
  }, [drawRooms, highlightIndex, activeRoom]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
    >
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ cursor: "pointer" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
