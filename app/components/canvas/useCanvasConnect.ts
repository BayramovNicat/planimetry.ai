import { useCallback, useRef } from "react";

import type { Room } from "../../types";
import type { ConnectPreview, ScreenRect } from "./canvasTypes";
import { getCircleRadius } from "./drawHelpers";

interface ConnectDragState {
  fromIndex: number;
  fromX: number;
  fromY: number;
}

export function useCanvasConnect(rooms: Room[]) {
  const dragRef = useRef<ConnectDragState | null>(null);
  const previewRef = useRef<ConnectPreview | null>(null);

  /** Hit-test: is the mouse over a panorama room's circle? Returns index or null. */
  const hitTestCircle = useCallback(
    (mx: number, my: number, rects: ScreenRect[]): number | null => {
      for (let i = rooms.length - 1; i >= 0; i--) {
        if (!rooms[i].panoramaImage) continue;
        const { x, y, w, h } = rects[i];
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = getCircleRadius(w, h) + 4; // tolerance
        const dx = mx - cx;
        const dy = my - cy;
        if (dx * dx + dy * dy <= r * r) return i;
      }
      return null;
    },
    [rooms],
  );

  const startConnect = useCallback((index: number, rects: ScreenRect[]) => {
    const { x, y, w, h } = rects[index];
    const state: ConnectDragState = {
      fromIndex: index,
      fromX: x + w / 2,
      fromY: y + h / 2,
    };
    dragRef.current = state;
    previewRef.current = {
      fromIndex: index,
      fromX: state.fromX,
      fromY: state.fromY,
      toX: state.fromX,
      toY: state.fromY,
      targetIndex: null,
    };
  }, []);

  const updateConnect = useCallback(
    (mx: number, my: number, rects: ScreenRect[]): ConnectPreview | null => {
      const drag = dragRef.current;
      if (!drag) return null;

      const target = hitTestCircle(mx, my, rects);
      const validTarget = target !== null && target !== drag.fromIndex ? target : null;

      // Snap to target center
      let toX = mx;
      let toY = my;
      if (validTarget !== null) {
        const { x, y, w, h } = rects[validTarget];
        toX = x + w / 2;
        toY = y + h / 2;
      }

      const preview: ConnectPreview = {
        fromIndex: drag.fromIndex,
        fromX: drag.fromX,
        fromY: drag.fromY,
        toX,
        toY,
        targetIndex: validTarget,
      };
      previewRef.current = preview;
      return preview;
    },
    [hitTestCircle],
  );

  const endConnect = useCallback(
    (
      mx: number,
      my: number,
      rects: ScreenRect[],
      onConnect: (from: number, to: number) => void,
    ) => {
      const drag = dragRef.current;
      if (!drag) return;

      const target = hitTestCircle(mx, my, rects);
      if (target !== null && target !== drag.fromIndex) {
        onConnect(drag.fromIndex, target);
      }

      dragRef.current = null;
      previewRef.current = null;
    },
    [hitTestCircle],
  );

  const cancelConnect = useCallback(() => {
    dragRef.current = null;
    previewRef.current = null;
  }, []);

  return {
    dragRef,
    previewRef,
    hitTestCircle,
    startConnect,
    updateConnect,
    endConnect,
    cancelConnect,
  };
}
