"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AnalysisResult, Project } from "../types";

const MAX_HISTORY = 50;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface UseFloorPlanAnalyzerOptions {
  project: Project | null;
  onUpdate: (data: Partial<Pick<Project, "image" | "result">>) => void;
}

export function useFloorPlanAnalyzer({ project, onUpdate }: UseFloorPlanAnalyzerOptions) {
  const [image, setImage] = useState<string | null>(project?.image ?? null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(project?.result ?? null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<number | null>(null);
  const [activeRoom, setActiveRoom] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const undoStack = useRef<AnalysisResult[]>([]);
  const redoStack = useRef<AnalysisResult[]>([]);
  const [, setHistorySize] = useState(0);

  // Sync state when project changes (switching projects)
  const lastProjectId = useRef<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImageRef = useRef<(base64: string) => Promise<void>>(null as any);

  useEffect(() => {
    const currentId = project?.id ?? null;
    if (currentId !== lastProjectId.current) {
      lastProjectId.current = currentId;
      setImage(project?.image ?? null);
      setResult(project?.result ?? null);
      setError(null);
      setLoading(false);
      setHoveredRoom(null);
      setActiveRoom(null);
      undoStack.current = [];
      redoStack.current = [];
      setHistorySize(0);

      // Auto-analyze if project has image but no result yet
      if (project?.image && !project?.result) {
        handleImageRef.current(project.image);
      }
    }
  }, [project]);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const commitResult = useCallback(
    (next: AnalysisResult) => {
      if (result) {
        undoStack.current.push(result);
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      }
      redoStack.current = [];
      setResult(next);
      setHistorySize(undoStack.current.length);
      onUpdateRef.current({ result: next });
    },
    [result],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev || !result) return;
    redoStack.current.push(result);
    setResult(prev);
    setHistorySize(undoStack.current.length);
    onUpdateRef.current({ result: prev });
  }, [result]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next || !result) return;
    undoStack.current.push(result);
    setResult(next);
    setHistorySize(undoStack.current.length);
    onUpdateRef.current({ result: next });
  }, [result]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const handleImage = useCallback(async (base64: string) => {
    setImage(base64);
    setResult(null);
    setError(null);
    setLoading(true);
    undoStack.current = [];
    redoStack.current = [];
    setHistorySize(0);
    onUpdateRef.current({ image: base64, result: null });

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
      onUpdateRef.current({ result: data });
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

  handleImageRef.current = handleImage;

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

  const updateRoom = useCallback(
    (index: number, fields: { name?: string; area?: number }) => {
      if (!result) return;
      const room = result.rooms[index];
      if (!room) return;

      const updated = { ...room };
      if (fields.name !== undefined) {
        updated.name = fields.name;
      }
      if (fields.area !== undefined && fields.area > 0) {
        const ratio = room.width / room.height;
        updated.area = fields.area;
        updated.height = Math.round(Math.sqrt(fields.area / ratio) * 10) / 10;
        updated.width = Math.round((fields.area / updated.height) * 10) / 10;
      }

      const updatedRooms = result.rooms.map((r, i) =>
        i === index ? updated : r,
      );
      commitResult({ ...result, rooms: updatedRooms });
    },
    [result, commitResult],
  );

  const moveRoom = useCallback(
    (index: number, bbox: [number, number, number, number]) => {
      if (!result) return;
      const room = result.rooms[index];
      if (!room) return;
      const updatedRooms = result.rooms.map((r, i) =>
        i === index ? { ...r, bbox } : r,
      );
      commitResult({ ...result, rooms: updatedRooms });
    },
    [result, commitResult],
  );

  const remeasureRoom = useCallback(
    (index: number, pxWidth: number, pxHeight: number) => {
      if (!result) return;
      const room = result.rooms[index];
      if (!room) return;

      const aspectRatio = pxWidth / pxHeight;
      const newHeight =
        Math.round(Math.sqrt(room.area / aspectRatio) * 10) / 10;
      const newWidth = Math.round((room.area / newHeight) * 10) / 10;

      const [ymin, xmin, ymax, xmax] = room.bbox;
      const cx = (xmin + xmax) / 2;
      const cy = (ymin + ymax) / 2;
      const oldBboxW = xmax - xmin;
      const oldBboxH = ymax - ymin;
      const bboxArea = oldBboxW * oldBboxH || 1;
      const newBboxW = Math.sqrt(bboxArea * aspectRatio);
      const newBboxH = bboxArea / newBboxW;
      const newBbox: [number, number, number, number] = [
        cy - newBboxH / 2,
        cx - newBboxW / 2,
        cy + newBboxH / 2,
        cx + newBboxW / 2,
      ];

      const updatedRooms = result.rooms.map((r, i) =>
        i === index
          ? { ...r, width: newWidth, height: newHeight, bbox: newBbox }
          : r,
      );
      commitResult({ ...result, rooms: updatedRooms });
      setActiveRoom(null);
    },
    [result, commitResult],
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
    remeasureRoom,
    moveRoom,
    undo,
    redo,
    canUndo,
    canRedo,
    handleFile,
    handleDrop,
    fileInputRef,
  };
}
