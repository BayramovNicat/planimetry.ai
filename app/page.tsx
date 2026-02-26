"use client";

import { useRef, useEffect } from "react";
import { useFloorPlanAnalyzer } from "./hooks/useFloorPlanAnalyzer";
import { ImageDropZone } from "./components/ImageDropZone";
import { ImagePreview } from "./components/ImagePreview";
import { FloorPlanCanvas } from "./components/FloorPlanCanvas";
import { RoomCardGrid } from "./components/RoomCardGrid";
import { LoadingSkeleton } from "./components/LoadingSkeleton";

export default function Home() {
  const {
    image,
    loading,
    result,
    error,
    hoveredRoom,
    setHoveredRoom,
    handleFile,
    handleDrop,
    reset,
    fileInputRef,
  } = useFloorPlanAnalyzer();

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result && canvasRef.current) {
      canvasRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
          Floor Plan Analyzer
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8">
          Upload or paste a floor plan image to extract room dimensions
        </p>

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
              onClose={reset}
              overlay={loading ? <LoadingSkeleton /> : undefined}
            />

            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {result && (
              <div ref={canvasRef} className="space-y-6">
                {result.total_area && (
                  <div className="inline-block px-4 py-2 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold">
                    Total area: {result.total_area} m²
                  </div>
                )}

                <FloorPlanCanvas
                  rooms={result.rooms}
                  highlightIndex={hoveredRoom}
                  onHoverRoom={setHoveredRoom}
                />

                <RoomCardGrid
                  rooms={result.rooms}
                  hoveredRoom={hoveredRoom}
                  onHoverRoom={setHoveredRoom}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
