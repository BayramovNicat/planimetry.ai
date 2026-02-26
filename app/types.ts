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
