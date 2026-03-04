"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeRooms } from "../components/canvas/normalizeRooms";
import type { AnalysisResult, Project } from "../types";
import { calculateDimensions } from "../utils/dimensions";
import { fileToBase64 } from "../utils/fileToBase64";
import { saveImage } from "../utils/imageStore";
import { loadProjectImage } from "./useProjects";

const MAX_HISTORY = 50;

interface UseFloorPlanAnalyzerOptions {
  project: Project | null;
  onUpdate: (data: Partial<Pick<Project, "imageId" | "result">>) => void;
  /** When true, skip the global paste listener (caller manages paste routing) */
  disablePaste?: boolean;
}

export function useFloorPlanAnalyzer({
  project,
  onUpdate,
  disablePaste,
}: UseFloorPlanAnalyzerOptions) {
  const [image, setImage] = useState<string | null>(null);
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
  const [prevProjectId, setPrevProjectId] = useState<string | null>(null);
  const currentId = project?.id ?? null;

  if (currentId !== prevProjectId) {
    setPrevProjectId(currentId);
    setResult(project?.result ?? null);
    setError(null);
    setLoading(false);
    setHoveredRoom(null);
    setActiveRoom(null);
    undoStack.current = [];
    redoStack.current = [];
    setHistorySize(0);
  }

  const handleImageRef = useRef<((base64: string) => Promise<void>) | null>(null);
  const isAnalyzingRef = useRef<string | null>(null); // Track imageId being analyzed

  useEffect(() => {
    const projectId = project?.id;
    const imageId = project?.imageId;

    if (projectId) {
      let cancelled = false;
      loadProjectImage(project).then((base64) => {
        if (cancelled) return;
        setImage(base64);

        // Auto-analyze if project has image but no result yet, AND we aren't already analyzing it
        if (base64 && !project.result && !loading && isAnalyzingRef.current !== imageId) {
          handleImageRef.current?.(base64);
        }
      });
      return () => {
        cancelled = true;
      };
    } else {
      setImage(null);
    }
  }, [project, loading]); // project is now a dependency to satisfy ESLint

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

  const handleImage = useCallback(
    async (base64: string) => {
      if (loading) return;

      const imageId = project ? `fp_${project.id}` : null;
      if (imageId) isAnalyzingRef.current = imageId;

      setImage(base64);
      setResult(null);
      setError(null);
      setLoading(true);
      undoStack.current = [];
      redoStack.current = [];
      setHistorySize(0);

      // Save image to IDB and update project reference
      if (project && imageId) {
        saveImage(imageId, base64).catch((e) =>
          console.error("[Planimetry] Failed to save floor plan image:", e),
        );
      }
      onUpdateRef.current({ result: null });

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
        // Assign stable colorIndex to each room
        data.rooms = data.rooms.map((r, i) => ({ ...r, colorIndex: r.colorIndex ?? i }));
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
        isAnalyzingRef.current = null;
      }
    },
    [project, loading],
  );

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
    if (disablePaste) return;
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
  }, [handleFile, disablePaste]);

  const updateRoom = useCallback(
    (
      index: number,
      fields: {
        name?: string;
        area?: number;
        width?: number;
        height?: number;
        bbox?: [number, number, number, number];
        panoramaImageId?: string | null;
        panoramaNorthAngle?: number;
      },
    ) => {
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
      if (fields.width !== undefined) updated.width = fields.width;
      if (fields.height !== undefined) updated.height = fields.height;
      if (fields.bbox !== undefined) updated.bbox = fields.bbox;
      if (fields.panoramaImageId !== undefined) {
        updated.panoramaImageId =
          fields.panoramaImageId === null ? undefined : fields.panoramaImageId;
      }
      if (fields.panoramaNorthAngle !== undefined) {
        updated.panoramaNorthAngle = fields.panoramaNorthAngle;
      }

      const updatedRooms = result.rooms.map((r, i) => (i === index ? updated : r));
      commitResult({ ...result, rooms: updatedRooms });
    },
    [result, commitResult],
  );

  const moveRoom = useCallback(
    (index: number, bbox: [number, number, number, number]) => {
      if (!result) return;
      const room = result.rooms[index];
      if (!room) return;

      const dy = bbox[0] - room.bbox[0];
      const dx = bbox[1] - room.bbox[1];

      const updated: Partial<typeof room> & { bbox: typeof bbox } = { bbox };
      if (room.subRects) {
        updated.subRects = room.subRects.map(
          (r) => [r[0] + dy, r[1] + dx, r[2] + dy, r[3] + dx] as [number, number, number, number],
        );
      }

      const updatedRooms = result.rooms.map((r, i) => (i === index ? { ...r, ...updated } : r));
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
      const newHeight = Math.round(Math.sqrt(room.area / aspectRatio) * 10) / 10;
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
        i === index ? { ...r, width: newWidth, height: newHeight, bbox: newBbox } : r,
      );
      commitResult({ ...result, rooms: updatedRooms });
      setActiveRoom(null);
    },
    [result, commitResult],
  );

  const mergeRooms = useCallback(
    (indexA: number, indexB: number) => {
      if (!result) return;
      const roomA = result.rooms[indexA];
      const roomB = result.rooms[indexB];
      if (!roomA || !roomB) return;

      // Use normalized bboxes so sub-rects match what the user sees on canvas
      const normalized = normalizeRooms(result.rooms);
      const normA = normalized[indexA];
      const normB = normalized[indexB];

      const rectsA: [number, number, number, number][] = normA.subRects ?? [
        normA.bbox as [number, number, number, number],
      ];
      const rectsB: [number, number, number, number][] = normB.subRects ?? [
        normB.bbox as [number, number, number, number],
      ];
      const allRects = [...rectsA, ...rectsB];

      const newArea = roomA.area + roomB.area;
      const newBbox: [number, number, number, number] = [
        Math.min(...allRects.map((r) => r[0])),
        Math.min(...allRects.map((r) => r[1])),
        Math.max(...allRects.map((r) => r[2])),
        Math.max(...allRects.map((r) => r[3])),
      ];
      const bboxW = newBbox[3] - newBbox[1];
      const bboxH = newBbox[2] - newBbox[0];
      const { width, height } = calculateDimensions(bboxW, bboxH, newArea);

      const maxColor = Math.max(0, ...result.rooms.map((r) => r.colorIndex ?? 0));
      const merged = {
        name: `${roomA.name} + ${roomB.name}`,
        area: newArea,
        width,
        height,
        bbox: newBbox,
        subRects: allRects,
        colorIndex: maxColor + 1,
      };

      // Also normalize remaining rooms so everything is in the same coordinate space
      const rooms = normalized.map((r, i) => {
        // Strip subRects normalization — keep original data for non-merged rooms
        // but use their normalized bbox
        const orig = result!.rooms[i];
        return { ...orig, bbox: r.bbox as [number, number, number, number] };
      });
      const insertAt = Math.min(indexA, indexB);
      const removeAt = Math.max(indexA, indexB);
      rooms.splice(removeAt, 1);
      rooms.splice(insertAt, 1, merged);

      commitResult({ ...result, rooms });
      setActiveRoom(null);
    },
    [result, commitResult],
  );

  const splitRoom = useCallback(
    (index: number, orientation: "h" | "v", ratio: number) => {
      if (!result) return;
      const room = result.rooms[index];
      if (!room) return;

      const [ymin, xmin, ymax, xmax] = room.bbox;
      const area1 = room.area * ratio;
      const area2 = room.area * (1 - ratio);

      let bbox1: [number, number, number, number];
      let bbox2: [number, number, number, number];

      if (orientation === "h") {
        const splitY = ymin + (ymax - ymin) * ratio;
        bbox1 = [ymin, xmin, splitY, xmax];
        bbox2 = [splitY, xmin, ymax, xmax];
      } else {
        const splitX = xmin + (xmax - xmin) * ratio;
        bbox1 = [ymin, xmin, ymax, splitX];
        bbox2 = [ymin, splitX, ymax, xmax];
      }

      const bboxW1 = bbox1[3] - bbox1[1];
      const bboxH1 = bbox1[2] - bbox1[0];
      const dim1 = calculateDimensions(bboxW1, bboxH1, area1);

      const bboxW2 = bbox2[3] - bbox2[1];
      const bboxH2 = bbox2[2] - bbox2[0];
      const dim2 = calculateDimensions(bboxW2, bboxH2, area2);

      const maxColor = Math.max(0, ...result.rooms.map((r) => r.colorIndex ?? 0));
      const room1 = {
        name: `${room.name} (1)`,
        area: Number(area1.toFixed(2)),
        width: dim1.width,
        height: dim1.height,
        bbox: bbox1,
        colorIndex: maxColor + 1,
      };
      const room2 = {
        name: `${room.name} (2)`,
        area: Number(area2.toFixed(2)),
        width: dim2.width,
        height: dim2.height,
        bbox: bbox2,
        colorIndex: maxColor + 2,
      };

      const rooms = [...result.rooms];
      rooms.splice(index, 1, room1, room2);

      commitResult({ ...result, rooms });
      setActiveRoom(null);
    },
    [result, commitResult],
  );

  const reorderRooms = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!result) return;
      if (fromIndex === toIndex) return;
      const rooms = [...result.rooms];
      const [moved] = rooms.splice(fromIndex, 1);
      rooms.splice(toIndex, 0, moved);
      commitResult({ ...result, rooms });
      setActiveRoom(null);
    },
    [result, commitResult],
  );

  const addConnection = useCallback(
    (from: number, to: number) => {
      if (!result) return;
      const existing = result.connections ?? [];
      // Avoid duplicates (either direction)
      const isDuplicate = existing.some(
        (c) => (c.from === from && c.to === to) || (c.from === to && c.to === from),
      );
      if (isDuplicate) return;
      commitResult({ ...result, connections: [...existing, { from, to }] });
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
    mergeRooms,
    splitRoom,
    reorderRooms,
    addConnection,
    undo,
    redo,
    canUndo,
    canRedo,
    handleFile,
    handleDrop,
    fileInputRef,
  };
}
