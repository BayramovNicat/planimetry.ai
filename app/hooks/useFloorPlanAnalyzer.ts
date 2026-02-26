"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AnalysisResult } from "../types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useFloorPlanAnalyzer() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<number | null>(null);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImage = useCallback(async (base64: string) => {
    setImage(base64);
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "TimeoutError"
          ? "Analysis timed out — the AI took too long. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const base64 = await fileToBase64(file);
      handleImage(base64);
    },
    [handleImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  const moveRoom = useCallback(
    (index: number, bbox: [number, number, number, number]) => {
      if (!result) return;
      const room = result.rooms[index];
      if (!room) return;
      const updatedRooms = result.rooms.map((r, i) =>
        i === index ? { ...r, bbox } : r,
      );
      setResult({ ...result, rooms: updatedRooms });
    },
    [result],
  );

  const remeasureRoom = useCallback(
    (index: number, pxWidth: number, pxHeight: number) => {
      if (!result) return;
      const room = result.rooms[index];
      if (!room) return;

      const aspectRatio = pxWidth / pxHeight;
      const newHeight = Math.round(Math.sqrt(room.area / aspectRatio) * 10) / 10;
      const newWidth = Math.round((room.area / newHeight) * 10) / 10;

      // Adjust bbox to match new aspect ratio while keeping center and area in coordinate space
      const [ymin, xmin, ymax, xmax] = room.bbox;
      const cx = (xmin + xmax) / 2;
      const cy = (ymin + ymax) / 2;
      const oldBboxW = xmax - xmin;
      const oldBboxH = ymax - ymin;
      const bboxArea = oldBboxW * oldBboxH || 1;
      // new bbox dimensions: same area, new aspect ratio (w/h = aspectRatio)
      const newBboxW = Math.sqrt(bboxArea * aspectRatio);
      const newBboxH = bboxArea / newBboxW;
      const newBbox: [number, number, number, number] = [
        cy - newBboxH / 2,
        cx - newBboxW / 2,
        cy + newBboxH / 2,
        cx + newBboxW / 2,
      ];

      const updatedRooms = result.rooms.map((r, i) =>
        i === index ? { ...r, width: newWidth, height: newHeight, bbox: newBbox } : r,
      );
      setResult({ ...result, rooms: updatedRooms });
      setActiveRoom(null);
    },
    [result],
  );

  const reset = useCallback(() => {
    setImage(null);
    setResult(null);
    setError(null);
    setLoading(false);
    setHoveredRoom(null);
    setActiveRoom(null);
  }, []);

  return {
    image,
    loading,
    result,
    error,
    hoveredRoom,
    setHoveredRoom,
    activeRoom,
    setActiveRoom,
    remeasureRoom,
    moveRoom,
    handleFile,
    handleDrop,
    reset,
    fileInputRef,
  };
}
