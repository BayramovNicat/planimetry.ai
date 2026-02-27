import { useCallback, useRef } from "react";

import type { Room } from "../../types";
import type { Bbox, DragState, SnapLine } from "./canvasTypes";
import { getRoomEdges, SNAP_PX, snapBbox } from "./snapUtils";

/**
 * Manages drag state for move and resize operations on the canvas.
 * Single Responsibility: only drag state mutations and bbox computation.
 */
export function useCanvasDrag(normalizedRooms: Room[]) {
  const dragRef = useRef<DragState | null>(null);
  const dragBboxRef = useRef<Bbox | null>(null);
  const dragSizeRef = useRef<{ w: number; h: number } | null>(null);
  const snapLinesRef = useRef<SnapLine[]>([]);

  /** Begin a move drag on a room */
  const startMoveDrag = useCallback(
    (index: number, mx: number, my: number) => {
      const room = normalizedRooms[index];
      dragRef.current = {
        index,
        type: "move",
        startMx: mx,
        startMy: my,
        origBbox: [...room.bbox],
        origWidth: room.width,
        origHeight: room.height,
        moved: false,
      };
      dragBboxRef.current = null;
      dragSizeRef.current = null;
      snapLinesRef.current = [];
    },
    [normalizedRooms],
  );

  /** Begin a resize drag on a room edge */
  const startResizeDrag = useCallback(
    (index: number, side: "top" | "bottom" | "left" | "right", mx: number, my: number) => {
      const room = normalizedRooms[index];
      dragRef.current = {
        index,
        type: "resize",
        side,
        startMx: mx,
        startMy: my,
        origBbox: [...room.bbox],
        origWidth: room.width,
        origHeight: room.height,
        moved: false,
      };
      dragBboxRef.current = null;
      dragSizeRef.current = null;
      snapLinesRef.current = [];
    },
    [normalizedRooms],
  );

  /** Update the drag position; returns the override box for rendering or null */
  const updateDrag = useCallback(
    (mx: number, my: number, scale: number, activeRoom: number | null) => {
      const drag = dragRef.current;
      if (!drag) return null;

      const dxPx = mx - drag.startMx;
      const dyPx = my - drag.startMy;

      if (!drag.moved && Math.abs(dxPx) < 4 && Math.abs(dyPx) < 4) return null;
      drag.moved = true;

      if (drag.type === "resize" && drag.side) {
        return updateResizeDrag(drag, dxPx, dyPx, scale, activeRoom);
      }

      return updateMoveDrag(drag, dxPx, dyPx, scale, activeRoom);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normalizedRooms],
  );

  /** Internal: handle move drag update */
  const updateMoveDrag = (
    drag: DragState,
    dxPx: number,
    dyPx: number,
    scale: number,
    activeRoom: number | null,
  ) => {
    const dxBbox = dxPx / scale;
    const dyBbox = dyPx / scale;
    const [ymin, xmin, ymax, xmax] = drag.origBbox;
    const rawBbox: Bbox = [ymin + dyBbox, xmin + dxBbox, ymax + dyBbox, xmax + dxBbox];

    const { bbox: snapped, lines } = snapBbox(drag.index, rawBbox, normalizedRooms, scale);
    dragBboxRef.current = snapped;
    snapLinesRef.current = lines;

    return {
      overrideBox: { index: drag.index, bbox: snapped },
      highlight: null as number | null,
      activeRoom,
    };
  };

  /** Internal: handle resize drag update */
  const updateResizeDrag = (
    drag: DragState,
    dxPx: number,
    dyPx: number,
    scale: number,
    activeRoom: number | null,
  ) => {
    const room = normalizedRooms[drag.index];
    const origBboxW = drag.origBbox[3] - drag.origBbox[1];
    const origBboxH = drag.origBbox[2] - drag.origBbox[0];
    const pxPerM = drag.origWidth > 0 ? origBboxW / drag.origWidth : 100;

    const dBbox = { x: dxPx / scale, y: dyPx / scale };
    const [orig_ymin, orig_xmin, orig_ymax, orig_xmax] = drag.origBbox;

    // Compute raw moving edge position
    let movingEdge: number;
    let orientation: "v" | "h";

    if (drag.side === "right") {
      movingEdge = orig_xmax + dBbox.x;
      orientation = "v";
    } else if (drag.side === "left") {
      movingEdge = orig_xmin + dBbox.x;
      orientation = "v";
    } else if (drag.side === "bottom") {
      movingEdge = orig_ymax + dBbox.y;
      orientation = "h";
    } else {
      movingEdge = orig_ymin + dBbox.y;
      orientation = "h";
    }

    // Snap moving edge to other rooms' edges
    const snapThreshold = SNAP_PX / scale;
    let snappedEdge = movingEdge;
    let bestDist = Infinity;
    const lines: SnapLine[] = [];

    for (let i = 0; i < normalizedRooms.length; i++) {
      if (i === drag.index) continue;
      const { xEdges, yEdges } = getRoomEdges(normalizedRooms[i]);
      const targets = orientation === "v" ? xEdges : yEdges;
      for (const t of targets) {
        const dist = Math.abs(movingEdge - t);
        if (dist < snapThreshold && dist < bestDist) {
          bestDist = dist;
          snappedEdge = t;
        }
      }
    }

    if (bestDist < snapThreshold) {
      lines.push({ orientation, pos: snappedEdge });
    }

    // Derive new dimensions from snapped edge
    let newW: number;
    let newH: number;

    if (drag.side === "right") {
      newW = Math.max(0.2, (snappedEdge - orig_xmin) / pxPerM);
      newH = room.area / newW;
    } else if (drag.side === "left") {
      newW = Math.max(0.2, (orig_xmax - snappedEdge) / pxPerM);
      newH = room.area / newW;
    } else if (drag.side === "bottom") {
      newH = Math.max(0.2, (snappedEdge - orig_ymin) / pxPerM);
      newW = room.area / newH;
    } else {
      newH = Math.max(0.2, (orig_ymax - snappedEdge) / pxPerM);
      newW = room.area / newH;
    }

    newW = Math.round(newW * 100) / 100;
    newH = Math.round(newH * 100) / 100;

    let new_xmin = orig_xmin;
    let new_ymin = orig_ymin;

    // Anchor the opposite edge, center the orthogonal axis
    if (drag.side === "right") {
      new_xmin = orig_xmin;
      new_ymin = orig_ymin + (origBboxH - newH * pxPerM) / 2;
    } else if (drag.side === "left") {
      new_xmin = orig_xmax - newW * pxPerM;
      new_ymin = orig_ymin + (origBboxH - newH * pxPerM) / 2;
    } else if (drag.side === "bottom") {
      new_ymin = orig_ymin;
      new_xmin = orig_xmin + (origBboxW - newW * pxPerM) / 2;
    } else if (drag.side === "top") {
      new_ymin = orig_ymax - newH * pxPerM;
      new_xmin = orig_xmin + (origBboxW - newW * pxPerM) / 2;
    }

    const newBbox: Bbox = [new_ymin, new_xmin, new_ymin + newH * pxPerM, new_xmin + newW * pxPerM];

    dragBboxRef.current = newBbox;
    dragSizeRef.current = { w: newW, h: newH };
    snapLinesRef.current = lines;

    return {
      overrideBox: {
        index: drag.index,
        bbox: newBbox,
        isResize: true,
        tempW: newW,
        tempH: newH,
      },
      highlight: null as number | null,
      activeRoom,
    };
  };

  /** Finish the drag, calling the appropriate callback */
  const endDrag = useCallback(
    (
      onMoveRoom: (index: number, bbox: Bbox) => void,
      onUpdateRoom?: (index: number, data: Partial<Room>) => void,
    ) => {
      const drag = dragRef.current;
      if (!drag) return false;

      let committed = false;
      if (drag.moved && dragBboxRef.current) {
        if (drag.type === "resize" && dragSizeRef.current && onUpdateRoom) {
          onUpdateRoom(drag.index, {
            width: dragSizeRef.current.w,
            height: dragSizeRef.current.h,
            bbox: dragBboxRef.current,
          });
        } else {
          onMoveRoom(drag.index, dragBboxRef.current);
        }
        committed = true;
      }

      dragRef.current = null;
      dragBboxRef.current = null;
      dragSizeRef.current = null;
      snapLinesRef.current = [];

      return committed;
    },
    [],
  );

  /** Cancel drag without committing */
  const cancelDrag = useCallback(() => {
    dragRef.current = null;
    dragBboxRef.current = null;
    dragSizeRef.current = null;
    snapLinesRef.current = [];
  }, []);

  return {
    dragRef,
    dragBboxRef,
    dragSizeRef,
    snapLinesRef,
    startMoveDrag,
    startResizeDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  };
}
