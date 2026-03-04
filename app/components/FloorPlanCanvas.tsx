"use client";

import { useEffect, useMemo, useRef } from "react";

import type { Room } from "../types";
import type { Connection } from "./canvas/canvasTypes";
import { normalizeRooms } from "./canvas/normalizeRooms";
import { useCanvasInteraction } from "./canvas/useCanvasInteraction";
import { useCanvasRenderer } from "./canvas/useCanvasRenderer";

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
  connectMode?: boolean;
  connections?: Connection[];
  onConnect?: (from: number, to: number) => void;
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
  connectMode,
  connections,
  onConnect,
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
      connectMode,
      connections,
      onHoverRoom,
      onSelectRoom,
      onMoveRoom,
      onUpdateRoom,
      onSplit,
      onMergeRooms,
      onConnect,
      drawRooms,
    });

  useEffect(() => {
    drawRooms(
      highlightIndex,
      connectMode ? null : activeRoom,
      undefined,
      connectMode
        ? {
            connectMode: true,
            connections,
          }
        : undefined,
    );
  }, [drawRooms, highlightIndex, activeRoom, connectMode, connections]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <canvas
        ref={canvasRef}
        className="block w-full"
        style={{ cursor: "pointer" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
