"use client";

import { Link, Redo2, Scissors, Undo2, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { useFloorPlanAnalyzer } from "../hooks/useFloorPlanAnalyzer";
import type { AnalysisResult, Project } from "../types";
import { wallArea } from "../utils/dimensions";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
import { ImagePreview } from "./ImagePreview";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { type PanoramaHotspot, PanoramaViewer } from "./PanoramaViewer";
import { RoomCardGrid } from "./RoomCardGrid";
import { Tooltip } from "./Tooltip";

function computeTotalArea(result: AnalysisResult): number {
  return (
    result.total_area ?? Math.round(result.rooms.reduce((sum, r) => sum + r.area, 0) * 100) / 100
  );
}

export function useFloorPlanEditor(
  project: Project | null,
  onUpdate: (data: Partial<Pick<Project, "image" | "result">>) => void,
  options?: { disablePaste?: boolean },
) {
  const { activeRoom, remeasureRoom, ...rest } = useFloorPlanAnalyzer({
    project,
    onUpdate,
    disablePaste: options?.disablePaste,
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
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

  return {
    ...rest,
    activeRoom,
    remeasureRoom,
    canvasRef,
    splitMode,
    setSplitMode,
    connectMode,
    setConnectMode,
    handleDrawRect,
  };
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
  const {
    image,
    loading,
    error,
    result,
    canvasRef,
    activeRoom,
    hoveredRoom,
    setHoveredRoom,
    setActiveRoom,
    handleDrawRect,
    undo,
    redo,
    canUndo,
    canRedo,
    splitMode,
    setSplitMode,
    connectMode,
    setConnectMode,
    moveRoom,
    updateRoom,
    splitRoom,
    mergeRooms,
    reorderRooms,
    addConnection,
  } = state;

  const [panoramaRoom, setPanoramaRoom] = useState<number | null>(null);

  const panoramaHotspots = useMemo<PanoramaHotspot[]>(() => {
    if (panoramaRoom === null || !result?.connections) return [];
    const current = result.rooms[panoramaRoom];
    if (!current) return [];
    const [cy1, cx1, cy2, cx2] = current.bbox;
    const curCx = (cx1 + cx2) / 2;
    const curCy = (cy1 + cy2) / 2;

    return result.connections
      .flatMap((c) => (c.from === panoramaRoom ? [c.to] : c.to === panoramaRoom ? [c.from] : []))
      .filter((i) => result.rooms[i]?.panoramaImage)
      .map((i) => {
        const r = result.rooms[i];
        const [ry1, rx1, ry2, rx2] = r.bbox;
        const dx = (rx1 + rx2) / 2 - curCx;
        const dy = (ry1 + ry2) / 2 - curCy;
        // Raw floor plan direction — north offset applied inside PanoramaViewer
        const yaw = Math.atan2(dx, -dy);
        return { id: i, name: r.name, yaw, pitch: -0.2 };
      });
  }, [panoramaRoom, result]);

  const handleViewPanorama = useCallback((index: number) => {
    setPanoramaRoom(index);
  }, []);

  if (!image) return null;

  return (
    <div className="space-y-4">
      <ImagePreview
        src={image}
        overlay={loading ? <LoadingSkeleton /> : undefined}
        activeRoom={activeRoom}
        onDrawRect={handleDrawRect}
        imgClassName={imgClassName}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div ref={canvasRef} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-block rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              Area: {computeTotalArea(result)} m²
            </div>
            <div className="inline-block rounded-full bg-zinc-700 px-2.5 py-1 text-xs font-semibold text-white dark:bg-zinc-300 dark:text-zinc-900">
              Walls:{" "}
              {Math.round(
                result.rooms.reduce((sum, r) => sum + wallArea(r.width, r.height), 0) * 100,
              ) / 100}{" "}
              m²
            </div>
            <div className="flex gap-1">
              <Tooltip label="Undo" side="bottom">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <Undo2 size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Redo" side="bottom">
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <Redo2 size={14} />
                </button>
              </Tooltip>
            </div>
            {activeRoom !== null && !connectMode && (
              <div className="flex items-center gap-1.5">
                <Tooltip label="Split room" side="bottom">
                  <button
                    onClick={() => setSplitMode((v) => !v)}
                    className={`cursor-pointer rounded-lg border px-2 py-1 text-sm transition-colors ${
                      splitMode
                        ? "border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <Scissors size={14} />
                  </button>
                </Tooltip>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {splitMode ? "Click to split" : "Shift+click to merge"}
                </span>
              </div>
            )}
            <Tooltip label="Connect rooms" side="bottom">
              <button
                onClick={() => {
                  setConnectMode((v) => {
                    if (!v) setSplitMode(false);
                    return !v;
                  });
                }}
                className={`cursor-pointer rounded-lg border px-2 py-1 text-sm transition-colors ${
                  connectMode
                    ? "border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <Link size={14} />
              </button>
            </Tooltip>
            {connectMode && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Drag between rooms to connect
              </span>
            )}
          </div>

          <FloorPlanCanvas
            rooms={result.rooms}
            highlightIndex={hoveredRoom}
            onHoverRoom={setHoveredRoom}
            activeRoom={activeRoom}
            onSelectRoom={setActiveRoom}
            onMoveRoom={moveRoom}
            onUpdateRoom={updateRoom}
            splitMode={splitMode}
            onSplit={splitRoom}
            onMergeRooms={mergeRooms}
            connectMode={connectMode}
            connections={result.connections}
            onConnect={addConnection}
          />

          <RoomCardGrid
            rooms={result.rooms}
            hoveredRoom={hoveredRoom}
            onHoverRoom={setHoveredRoom}
            activeRoom={activeRoom}
            onSelectRoom={setActiveRoom}
            onUpdateRoom={updateRoom}
            onReorderRooms={reorderRooms}
            onViewPanorama={handleViewPanorama}
          />
        </div>
      )}

      {/* Panorama overlay */}
      {panoramaRoom !== null && result?.rooms[panoramaRoom]?.panoramaImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 md:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPanoramaRoom(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPanoramaRoom(null);
          }}
        >
          <div className="relative w-full max-w-4xl">
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => setPanoramaRoom(null)}
                className="cursor-pointer rounded p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <PanoramaViewer
              key={panoramaRoom}
              initialImage={result.rooms[panoramaRoom].panoramaImage}
              sceneName={result.rooms[panoramaRoom].name}
              hotspots={panoramaHotspots}
              onNavigate={setPanoramaRoom}
              northAngle={result.rooms[panoramaRoom].panoramaNorthAngle ?? 0}
              onNorthAngleChange={(angle) =>
                updateRoom(panoramaRoom, { panoramaNorthAngle: angle })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
