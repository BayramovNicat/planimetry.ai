"use client";

import { Redo2, Scissors, Undo2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useProjectsContext } from "../../../components/ClientLayout";
import { FloorPlanCanvas } from "../../../components/FloorPlanCanvas";
import { ImagePreview } from "../../../components/ImagePreview";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton";
import { RoomCardGrid } from "../../../components/RoomCardGrid";
import { Tooltip } from "../../../components/Tooltip";
import { useFloorPlanAnalyzer } from "../../../hooks/useFloorPlanAnalyzer";
import type { Project } from "../../../types";

function useFloorPlanSide(
  project: Project | null,
  onUpdate: (data: Partial<Pick<Project, "image" | "result">>) => void,
) {
  const {
    image,
    loading,
    result,
    error,
    hoveredRoom,
    setHoveredRoom,
    activeRoom,
    setActiveRoom,
    updateRoom,
    remeasureRoom,
    moveRoom,
    mergeRooms,
    splitRoom,
    undo,
    redo,
    canUndo,
    canRedo,
    handleFile,
    handleDrop,
    fileInputRef,
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

  return {
    image,
    loading,
    result,
    error,
    hoveredRoom,
    setHoveredRoom,
    activeRoom,
    setActiveRoom,
    updateRoom,
    moveRoom,
    mergeRooms,
    splitRoom,
    undo,
    redo,
    canUndo,
    canRedo,
    handleFile,
    handleDrop,
    fileInputRef,
    canvasRef,
    splitMode,
    setSplitMode,
    handleDrawRect,
  };
}

export default function ComparePage() {
  const params = useParams<{ id1: string; id2: string }>();
  const router = useRouter();
  const { projects, updateProject } = useProjectsContext();

  const project1 = projects.find((p) => p.id === params.id1) ?? null;
  const project2 = projects.find((p) => p.id === params.id2) ?? null;

  const onUpdateLeft = useCallback(
    (data: Partial<Pick<Project, "image" | "result">>) => {
      if (params.id1) updateProject(params.id1, data);
    },
    [params.id1, updateProject],
  );

  const onUpdateRight = useCallback(
    (data: Partial<Pick<Project, "image" | "result">>) => {
      if (params.id2) updateProject(params.id2, data);
    },
    [params.id2, updateProject],
  );

  const left = useFloorPlanSide(project1, onUpdateLeft);
  const right = useFloorPlanSide(project2, onUpdateRight);

  const [focusedSide, setFocusedSide] = useState<"left" | "right">("left");

  // Keyboard: undo/redo applies to focused side
  useEffect(() => {
    const focused = focusedSide === "left" ? left : right;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        left.setActiveRoom(null);
        right.setActiveRoom(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        focused.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        focused.redo();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedSide, left, right]);

  // Redirect if either project not found
  useEffect(() => {
    if (projects.length > 0 && (!project1 || !project2)) {
      router.replace("/");
    }
  }, [projects, project1, project2, router]);

  if (!project1 || !project2) {
    return null;
  }

  const sides = [
    { side: "left" as const, project: project1, s: left },
    { side: "right" as const, project: project2, s: right },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl pt-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sides.map(({ side, project, s }) => (
            <div
              key={side}
              className={`rounded-xl border p-4 transition-colors ${
                focusedSide === side
                  ? "border-blue-300 dark:border-blue-700"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
              onPointerDown={() => setFocusedSide(side)}
            >
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {project.name}
              </h2>

              {s.image && (
                <div className="space-y-4">
                  <div className="h-64 [&_img]:max-h-64">
                    <ImagePreview
                      src={s.image}
                      overlay={s.loading ? <LoadingSkeleton /> : undefined}
                      activeRoom={s.activeRoom}
                      onDrawRect={s.handleDrawRect}
                    />
                  </div>

                  {s.error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                      {s.error}
                    </div>
                  )}

                  {s.result && (
                    <div ref={s.canvasRef} className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-block rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                          {s.result.total_area ??
                            Math.round(
                              s.result.rooms.reduce((sum, r) => sum + r.area, 0) * 100,
                            ) / 100}{" "}
                          m²
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
                      />
                    </div>
                  )}
                </div>
              )}

              {!s.image && (
                <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  No image uploaded for this plan
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
