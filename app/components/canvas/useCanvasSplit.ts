import { useCallback, useRef } from "react";
import type { Room } from "../../types";
import type { LayoutInfo, ScreenRect, SplitPreview } from "./canvasTypes";
import { snapSplitPosition } from "./snapUtils";

/**
 * Manages split-mode preview and execution.
 * Single Responsibility: only split preview state and split action.
 */
export function useCanvasSplit(normalizedRooms: Room[]) {
  const splitPreviewRef = useRef<SplitPreview | null>(null);

  /** Update the split preview based on mouse position */
  const updateSplitPreview = useCallback(
    (
      mx: number,
      my: number,
      activeRoom: number,
      activeRect: ScreenRect,
      layout: LayoutInfo,
    ): SplitPreview | null => {
      if (
        mx < activeRect.x ||
        mx > activeRect.x + activeRect.w ||
        my < activeRect.y ||
        my > activeRect.y + activeRect.h
      ) {
        splitPreviewRef.current = null;
        return null;
      }

      // Determine orientation: horizontal if cursor is closer to horizontal edge
      const relX = (mx - activeRect.x) / activeRect.w - 0.5;
      const relY = (my - activeRect.y) / activeRect.h - 0.5;
      const orientation: "h" | "v" =
        Math.abs(relY) > Math.abs(relX) ? "h" : "v";

      const { snappedMx, snappedMy, snapped } = snapSplitPosition(
        mx,
        my,
        orientation,
        activeRoom,
        normalizedRooms,
        layout,
      );

      const preview: SplitPreview = {
        mx,
        my,
        snappedMx,
        snappedMy,
        orientation,
        snapped,
      };
      splitPreviewRef.current = preview;
      return preview;
    },
    [normalizedRooms],
  );

  /** Execute a split based on the current preview */
  const executeSplit = useCallback(
    (
      activeRoom: number,
      activeRect: ScreenRect,
      onSplit: (index: number, orientation: "h" | "v", ratio: number) => void,
    ): boolean => {
      const preview = splitPreviewRef.current;
      if (!preview) return false;

      if (preview.orientation === "h") {
        const clampedY = Math.max(
          activeRect.y,
          Math.min(activeRect.y + activeRect.h, preview.snappedMy),
        );
        const ratio = (clampedY - activeRect.y) / activeRect.h;
        if (ratio > 0.05 && ratio < 0.95) {
          splitPreviewRef.current = null;
          onSplit(activeRoom, "h", ratio);
          return true;
        }
      } else {
        const clampedX = Math.max(
          activeRect.x,
          Math.min(activeRect.x + activeRect.w, preview.snappedMx),
        );
        const ratio = (clampedX - activeRect.x) / activeRect.w;
        if (ratio > 0.05 && ratio < 0.95) {
          splitPreviewRef.current = null;
          onSplit(activeRoom, "v", ratio);
          return true;
        }
      }
      return false;
    },
    [],
  );

  /** Clear the split preview */
  const clearSplitPreview = useCallback(() => {
    splitPreviewRef.current = null;
  }, []);

  return {
    splitPreviewRef,
    updateSplitPreview,
    executeSplit,
    clearSplitPreview,
  };
}
