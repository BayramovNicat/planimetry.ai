export interface Room {
  name: string;
  area: number;
  width: number;
  height: number;
  bbox: [number, number, number, number];
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
