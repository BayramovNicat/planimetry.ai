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
  /** ID of the panorama image from the project gallery */
  panoramaImageId?: string;
  /** North angle offset for panorama in radians — aligns pano orientation to floor plan */
  panoramaNorthAngle?: number;
}

export interface AnalysisResult {
  total_area: number | null;
  rooms: Room[];
  connections?: Array<{ from: number; to: number }>;
}

export interface GalleryImage {
  id: string;
  /** Base64 data URL — only present at runtime after loading from IndexedDB */
  base64?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  /** Reference ID to the floor plan image stored in IndexedDB */
  imageId?: string;
  result: AnalysisResult | null;
  createdAt: number;
  gallery?: GalleryImage[];
}
