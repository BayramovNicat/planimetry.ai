export type Bbox = [number, number, number, number];

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutInfo {
  rects: ScreenRect[];
  scale: number;
  offsetX: number;
  offsetY: number;
  minX: number;
  minY: number;
}

export interface DragState {
  index: number;
  type: "move" | "resize";
  side?: "top" | "bottom" | "left" | "right";
  startMx: number;
  startMy: number;
  origBbox: Bbox;
  origWidth: number;
  origHeight: number;
  moved: boolean;
}

export interface SplitPreview {
  mx: number;
  my: number;
  snappedMx: number;
  snappedMy: number;
  orientation: "h" | "v";
  snapped: boolean;
  /** Predicted dimensions for the two resulting sub-rooms */
  roomA: { width: number; height: number; area: number };
  roomB: { width: number; height: number; area: number };
}

export interface SnapLine {
  orientation: "h" | "v";
  pos: number;
}

export interface OverrideBox {
  index: number;
  bbox: Bbox;
  isResize?: boolean;
  tempW?: number;
  tempH?: number;
}

export interface Connection {
  from: number;
  to: number;
}

export interface ConnectPreview {
  fromIndex: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Index of the room being hovered over (for snap highlight) */
  targetIndex: number | null;
}
