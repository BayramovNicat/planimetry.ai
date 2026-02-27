"use client";

import { Redo2, Scissors,Undo2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback,useEffect, useRef, useState } from "react";

import { useProjectsContext } from "../../components/ClientLayout";
import { FloorPlanCanvas } from "../../components/FloorPlanCanvas";
import { ImageDropZone } from "../../components/ImageDropZone";
import { ImagePreview } from "../../components/ImagePreview";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { RoomCardGrid } from "../../components/RoomCardGrid";
import { Tooltip } from "../../components/Tooltip";
import { useFloorPlanAnalyzer } from "../../hooks/useFloorPlanAnalyzer";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { projects, updateProject } = useProjectsContext();

  const project = projects.find((p) => p.id === params.id) ?? null;

  const onUpdate = useCallback(
    (data: Parameters<typeof updateProject>[1]) => {
      if (params.id) updateProject(params.id, data);
    },
    [params.id, updateProject],
  );

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

  // Reset split mode when active room is deselected
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveRoom(null);
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setActiveRoom, undo, redo]);

  useEffect(() => {
    if (result && canvasRef.current) {
      canvasRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  // Redirect if project not found after hydration
  useEffect(() => {
    if (projects.length > 0 && !project) {
      router.replace("/");
    }
  }, [projects, project, router]);

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl pt-12">
        <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {project.name}
        </h1>

        {!image && (
          <ImageDropZone onFile={handleFile} onDrop={handleDrop} fileInputRef={fileInputRef} />
        )}

        {image && (
          <div className="space-y-6">
            <ImagePreview
              src={image}
              overlay={loading ? <LoadingSkeleton /> : undefined}
              activeRoom={activeRoom}
              onDrawRect={handleDrawRect}
            />

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            {result && (
              <div ref={canvasRef} className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  {result.total_area && (
                    <div className="inline-block rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                      Total area: {result.total_area} m²
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Tooltip label="Undo" side="bottom">
                      <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <Undo2 size={15} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Redo" side="bottom">
                      <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <Redo2 size={15} />
                      </button>
                    </Tooltip>
                  </div>
                  {activeRoom !== null && (
                    <div className="flex items-center gap-2">
                      <Tooltip label="Split room" side="bottom">
                        <button
                          onClick={() => setSplitMode((v) => !v)}
                          className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                            splitMode
                              ? "border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          }`}
                        >
                          <Scissors size={15} />
                        </button>
                      </Tooltip>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {splitMode ? "Click to split" : "Shift+click to merge"}
                      </span>
                    </div>
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
                />

                <RoomCardGrid
                  rooms={result.rooms}
                  hoveredRoom={hoveredRoom}
                  onHoverRoom={setHoveredRoom}
                  activeRoom={activeRoom}
                  onSelectRoom={setActiveRoom}
                  onUpdateRoom={updateRoom}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
