"use client";

import { Redo2, Scissors, Undo2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useFloorPlanAnalyzer } from "../hooks/useFloorPlanAnalyzer";
import type { AnalysisResult, Project } from "../types";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
import { ImagePreview } from "./ImagePreview";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { RoomCardGrid } from "./RoomCardGrid";
import { Tooltip } from "./Tooltip";

function computeTotalArea(result: AnalysisResult): number {
  return (
    result.total_area ??
    Math.round(result.rooms.reduce((sum, r) => sum + r.area, 0) * 100) / 100
  );
}

export function useFloorPlanEditor(
  project: Project | null,
  onUpdate: (data: Partial<Pick<Project, "image" | "result">>) => void,
) {
  const {
    activeRoom,
    remeasureRoom,
    ...rest
  } = useFloorPlanAnalyzer({ project, onUpdate });

  const canvasRef = useRef<HTMLDivElement>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [prevActiveRoom, setPrevActiveRoom] = useState(activeRoom);

  if (activeRoom !== prevActiveRoom) {
    setPrevActiveRoom(activeRoom);
    if (activeRoom === null) {
      setSplitMode(false);
    }
  }

  const handleDrawRect = useCallback(
    (pxW: number, pxH: number) => {
      if (activeRoom !== null) {
        remeasureRoom(activeRoom, pxW, pxH);
      }
    },
    [activeRoom, remeasureRoom],
  );

  return { ...rest, activeRoom, remeasureRoom, canvasRef, splitMode, setSplitMode, handleDrawRect };
}

export type FloorPlanEditorState = ReturnType<typeof useFloorPlanEditor>;

export function FloorPlanEditor({
  state,
  imgClassName,
}: {
  state: FloorPlanEditorState;
  /** Extra class for the <img> inside ImagePreview, e.g. "max-h-64" */
  imgClassName?: string;
}) {
  const s = state;

  if (!s.image) return null;

  return (
    <div className="space-y-4">
      <ImagePreview
        src={s.image}
        overlay={s.loading ? <LoadingSkeleton /> : undefined}
        activeRoom={s.activeRoom}
        onDrawRect={s.handleDrawRect}
        imgClassName={imgClassName}
      />

      {s.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {s.error}
        </div>
      )}

      {s.result && (
        <div ref={s.canvasRef} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-block rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {computeTotalArea(s.result)} m²
            </div>
            <div className="flex gap-1">
              <Tooltip label="Undo" side="bottom">
                <button
                  onClick={s.undo}
                  disabled={!s.canUndo}
                  className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <Undo2 size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Redo" side="bottom">
                <button
                  onClick={s.redo}
                  disabled={!s.canRedo}
                  className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <Redo2 size={14} />
                </button>
              </Tooltip>
            </div>
            {s.activeRoom !== null && (
              <div className="flex items-center gap-1.5">
                <Tooltip label="Split room" side="bottom">
                  <button
                    onClick={() => s.setSplitMode((v) => !v)}
                    className={`cursor-pointer rounded-lg border px-2 py-1 text-sm transition-colors ${
                      s.splitMode
                        ? "border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <Scissors size={14} />
                  </button>
                </Tooltip>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {s.splitMode ? "Click to split" : "Shift+click to merge"}
                </span>
              </div>
            )}
          </div>

          <FloorPlanCanvas
            rooms={s.result.rooms}
            highlightIndex={s.hoveredRoom}
            onHoverRoom={s.setHoveredRoom}
            activeRoom={s.activeRoom}
            onSelectRoom={s.setActiveRoom}
            onMoveRoom={s.moveRoom}
            onUpdateRoom={s.updateRoom}
            splitMode={s.splitMode}
            onSplit={s.splitRoom}
            onMergeRooms={s.mergeRooms}
          />

          <RoomCardGrid
            rooms={s.result.rooms}
            hoveredRoom={s.hoveredRoom}
            onHoverRoom={s.setHoveredRoom}
            activeRoom={s.activeRoom}
            onSelectRoom={s.setActiveRoom}
            onUpdateRoom={s.updateRoom}
            onReorderRooms={s.reorderRooms}
          />
        </div>
      )}
    </div>
  );
}
