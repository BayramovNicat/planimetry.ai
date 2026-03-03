export interface Room {
  name: string;
  area: number;
  width: number;
  height: number;
  bbox: [number, number, number, number];
  /** For merged/composite rooms: individual sub-rectangles preserving original shapes */
  subRects?: [number, number, number, number][];
  /** Stable color index assigned at creation, survives reordering */
  colorIndex?: number;
}

export interface AnalysisResult {
  total_area: number | null;
  rooms: Room[];
}

export interface Project {
  id: string;
  name: string;
  image: string | null;
  result: AnalysisResult | null;
  createdAt: number;
}
