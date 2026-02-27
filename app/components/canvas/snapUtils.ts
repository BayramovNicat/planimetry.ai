import type { Room } from "../../types";
import type { Bbox, ScreenRect, SnapLine } from "./canvasTypes";

export const SNAP_PX = 8;

/** Collect all X and Y edges from a room (sub-rects if composite, bbox otherwise) */
export function getRoomEdges(room: Room): {
  xEdges: number[];
  yEdges: number[];
} {
  const rects = room.subRects ?? [room.bbox];
  const xEdges = new Set<number>();
  const yEdges = new Set<number>();
  for (const [ymin, xmin, ymax, xmax] of rects) {
    xEdges.add(xmin);
    xEdges.add(xmax);
    yEdges.add(ymin);
    yEdges.add(ymax);
  }
  return { xEdges: [...xEdges], yEdges: [...yEdges] };
}

/** Snap a dragged bbox to other rooms' edges, returning snapped bbox and snap lines */
export function snapBbox(
  dragIndex: number,
  bbox: Bbox,
  rooms: Room[],
  scale: number,
): { bbox: Bbox; lines: SnapLine[] } {
  const [ymin, xmin, ymax, xmax] = bbox;
  const threshold = SNAP_PX / scale;

  let dx = 0;
  let dy = 0;
  const lines: SnapLine[] = [];

  const dragEdgesX = [xmin, xmax];
  const dragEdgesY = [ymin, ymax];

  let bestDx = Infinity;
  let bestDy = Infinity;

  for (let i = 0; i < rooms.length; i++) {
    if (i === dragIndex) continue;
    const { xEdges: otherEdgesX, yEdges: otherEdgesY } = getRoomEdges(rooms[i]);

    for (const de of dragEdgesX) {
      for (const oe of otherEdgesX) {
        const dist = Math.abs(de + dx - oe);
        if (dist < threshold && dist < Math.abs(bestDx)) {
          bestDx = oe - de;
        }
      }
    }
    for (const de of dragEdgesY) {
      for (const oe of otherEdgesY) {
        const dist = Math.abs(de + dy - oe);
        if (dist < threshold && dist < Math.abs(bestDy)) {
          bestDy = oe - de;
        }
      }
    }
  }

  if (Math.abs(bestDx) < Infinity) dx = bestDx;
  if (Math.abs(bestDy) < Infinity) dy = bestDy;

  const snappedBbox: Bbox = [ymin + dy, xmin + dx, ymax + dy, xmax + dx];

  if (dx !== 0) {
    const snappedEdgesX = [xmin + dx, xmax + dx];
    for (const se of snappedEdgesX) {
      for (let i = 0; i < rooms.length; i++) {
        if (i === dragIndex) continue;
        const { xEdges } = getRoomEdges(rooms[i]);
        for (const oe of xEdges) {
          if (Math.abs(se - oe) < threshold * 0.1) lines.push({ orientation: "v", pos: se });
        }
      }
    }
  }
  if (dy !== 0) {
    const snappedEdgesY = [ymin + dy, ymax + dy];
    for (const se of snappedEdgesY) {
      for (let i = 0; i < rooms.length; i++) {
        if (i === dragIndex) continue;
        const { yEdges } = getRoomEdges(rooms[i]);
        for (const oe of yEdges) {
          if (Math.abs(se - oe) < threshold * 0.1) lines.push({ orientation: "h", pos: se });
        }
      }
    }
  }

  return { bbox: snappedBbox, lines };
}

/** Snap a split preview position to nearby room edges */
export function snapSplitPosition(
  mx: number,
  my: number,
  orientation: "h" | "v",
  activeRoom: number,
  rooms: Room[],
  layout: {
    offsetX: number;
    offsetY: number;
    minX: number;
    minY: number;
    scale: number;
  },
): { snappedMx: number; snappedMy: number; snapped: boolean } {
  const { offsetX, offsetY, minX, minY, scale } = layout;
  let snappedMx = mx;
  let snappedMy = my;
  let snapped = false;

  for (let i = 0; i < rooms.length; i++) {
    if (i === activeRoom) continue;
    const { xEdges, yEdges } = getRoomEdges(rooms[i]);

    if (orientation === "h") {
      for (const yEdge of yEdges) {
        const screenY = offsetY + (yEdge - minY) * scale;
        if (Math.abs(my - screenY) < SNAP_PX) {
          snappedMy = screenY;
          snapped = true;
        }
      }
    } else {
      for (const xEdge of xEdges) {
        const screenX = offsetX + (xEdge - minX) * scale;
        if (Math.abs(mx - screenX) < SNAP_PX) {
          snappedMx = screenX;
          snapped = true;
        }
      }
    }
  }

  return { snappedMx, snappedMy, snapped };
}

/** Hit test: find the topmost room index under a screen coordinate */
export function hitTest(mx: number, my: number, rects: ScreenRect[]): number | null {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
      return i;
    }
  }
  return null;
}
