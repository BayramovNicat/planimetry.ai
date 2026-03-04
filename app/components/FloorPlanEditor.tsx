"use client";

import { Link, Redo2, Scissors, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useFloorPlanAnalyzer } from "../hooks/useFloorPlanAnalyzer";
import type { AnalysisResult, Project } from "../types";
import { wallArea } from "../utils/dimensions";
import { getImage } from "../utils/imageStore";
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
  onUpdate: (data: Partial<Pick<Project, "imageId" | "result">>) => void,
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
    project,
  };
}

export type FloorPlanEditorState = ReturnType<typeof useFloorPlanEditor>;

export function FloorPlanEditor({
  state,
  imgClassName,
  galleryImages,
}: {
  state: FloorPlanEditorState;
  /** Extra class for the <img> inside ImagePreview, e.g. "max-h-64" */
  imgClassName?: string;
  /** Gallery images with loaded base64 — used for panorama lookup */
  galleryImages?: Array<{ id: string; base64?: string }>;
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
  const [panoBase64, setPanoBase64] = useState<string | undefined>(undefined);
  const [prevPanoImgId, setPrevPanoImgId] = useState<string | undefined>(undefined);

  // Load panorama image from IDB when panoramaRoom changes
  const panoImgId = result?.rooms[panoramaRoom ?? -1]?.panoramaImageId;

  // Adjust state during render if the ID changes
  if (prevPanoImgId !== panoImgId) {
    setPrevPanoImgId(panoImgId);
    const fromGallery = galleryImages?.find((g) => g.id === panoImgId)?.base64;
    setPanoBase64(fromGallery);
  }

  useEffect(() => {
    if (!panoImgId || panoBase64) {
      return;
    }

    // Load from IDB
    let cancelled = false;
    getImage(panoImgId).then((base64) => {
      if (!cancelled && base64) setPanoBase64(base64);
    });
    return () => {
      cancelled = true;
    };
  }, [panoImgId, panoBase64]);

  const panoramaHotspots = useMemo<PanoramaHotspot[]>(() => {
    if (panoramaRoom === null || !result?.connections) return [];
    const current = result.rooms[panoramaRoom];
    if (!current) return [];
    const [cy1, cx1, cy2, cx2] = current.bbox;
    const curCx = (cx1 + cx2) / 2;
    const curCy = (cy1 + cy2) / 2;

    return result.connections
      .flatMap((c) => (c.from === panoramaRoom ? [c.to] : c.to === panoramaRoom ? [c.from] : []))
      .filter((i) => result.rooms[i]?.panoramaImageId)
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setPanoramaRoom(null);
    }
  }, []);

  if (!image) return null;

  return (
    <div className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
      {/* 1. Full-screen Modal for Panorama */}
      {panoramaRoom !== null && panoBase64 && (
        <div
          className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-md sm:p-8"
          onClick={(e) => {
            // Close modal if clicking the backdrop
            if (e.target === e.currentTarget) setPanoramaRoom(null);
          }}
        >
          <div className="relative w-full max-w-6xl overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
            <PanoramaViewer
              sceneName={result?.rooms[panoramaRoom]?.name}
              initialImage={panoBase64}
              hotspots={panoramaHotspots}
              onNavigate={setPanoramaRoom}
              northAngle={result?.rooms[panoramaRoom]?.panoramaNorthAngle ?? 0}
              onNorthAngleChange={(angle) =>
                updateRoom(panoramaRoom, { panoramaNorthAngle: angle })
              }
            />
            <button
              onClick={() => setPanoramaRoom(null)}
              className="absolute top-4 right-4 z-10 cursor-pointer rounded-full bg-black/50 p-2 text-white/70 transition-all hover:scale-110 hover:bg-red-500/80 hover:text-white"
              title="Close viewer (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}
