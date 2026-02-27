import type { Room, Bbox } from "./canvasTypes";

/**
 * Normalize room bboxes so they are sized by real-world dimensions (meters)
 * while preserving the AI-given center positions.
 */
export function normalizeRooms(rooms: Room[]): Room[] {
  if (rooms.length === 0) return [];

  // Compute a global pxPerM from the median of all rooms
  const ratios: number[] = [];
  for (const room of rooms) {
    if (room.width > 0 && room.height > 0) {
      const bboxW = room.bbox[3] - room.bbox[1];
      const bboxH = room.bbox[2] - room.bbox[0];
      if (bboxW > 0 && bboxH > 0) {
        ratios.push(bboxW / room.width, bboxH / room.height);
      }
    }
  }
  ratios.sort((a, b) => a - b);
  const pxPerM =
    ratios.length > 0 ? ratios[Math.floor(ratios.length / 2)] : 100;

  return rooms.map((room) => {
    const [ymin, xmin, ymax, xmax] = room.bbox;
    const cx = (xmin + xmax) / 2;
    const cy = (ymin + ymax) / 2;
    const halfW = (room.width * pxPerM) / 2;
    const halfH = (room.height * pxPerM) / 2;
    const newBbox = [cy - halfH, cx - halfW, cy + halfH, cx + halfW] as Bbox;

    let newSubRects: Bbox[] | undefined;
    if (room.subRects) {
      const dy = newBbox[0] - ymin;
      const dx = newBbox[1] - xmin;
      newSubRects = room.subRects.map(
        (r) => [r[0] + dy, r[1] + dx, r[2] + dy, r[3] + dx] as Bbox,
      );
    }

    return {
      ...room,
      bbox: newBbox,
      ...(newSubRects ? { subRects: newSubRects } : {}),
    };
  });
}
