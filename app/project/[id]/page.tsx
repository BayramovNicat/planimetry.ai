"use client";

import { useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjectsContext } from "../../components/ClientLayout";
import { useFloorPlanAnalyzer } from "../../hooks/useFloorPlanAnalyzer";
import { Undo2, Redo2 } from "lucide-react";
import { Tooltip } from "../../components/Tooltip";
import { ImageDropZone } from "../../components/ImageDropZone";
import { ImagePreview } from "../../components/ImagePreview";
import { FloorPlanCanvas } from "../../components/FloorPlanCanvas";
import { RoomCardGrid } from "../../components/RoomCardGrid";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";

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
    undo,
    redo,
    canUndo,
    canRedo,
    handleFile,
    handleDrop,
    fileInputRef,
  } = useFloorPlanAnalyzer({ project, onUpdate });

  const canvasRef = useRef<HTMLDivElement>(null);

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto pt-12">
        <h1 className="text-xl font-semibold mb-6 text-zinc-900 dark:text-zinc-100">
          {project.name}
        </h1>

        {!image && (
          <ImageDropZone
            onFile={handleFile}
            onDrop={handleDrop}
            fileInputRef={fileInputRef}
          />
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
              <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {result && (
              <div ref={canvasRef} className="space-y-6">
                <div className="flex items-center gap-3 flex-wrap">
                  {result.total_area && (
                    <div className="inline-block text-xs px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold">
                      Total area: {result.total_area} m²
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Tooltip label="Undo" side="bottom">
                      <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="px-2.5 py-1.5 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        <Undo2 size={15} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Redo" side="bottom">
                      <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="px-2.5 py-1.5 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        <Redo2 size={15} />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <FloorPlanCanvas
                  rooms={result.rooms}
                  highlightIndex={hoveredRoom}
                  onHoverRoom={setHoveredRoom}
                  activeRoom={activeRoom}
                  onSelectRoom={setActiveRoom}
                  onMoveRoom={moveRoom}
                  onUpdateRoom={updateRoom}
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
