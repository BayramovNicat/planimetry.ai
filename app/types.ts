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
  /** Base64 panorama image assigned from gallery drag-and-drop */
  panoramaImage?: string;
}

export interface AnalysisResult {
  total_area: number | null;
  rooms: Room[];
  connections?: Array<{ from: number; to: number }>;
}

export interface GalleryImage {
  id: string;
  base64: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  image: string | null;
  result: AnalysisResult | null;
  createdAt: number;
}
