"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Room } from "../types";
import { ROOM_COLORS } from "../constants";

const SNAP_PX = 8;

interface FloorPlanCanvasProps {
  rooms: Room[];
  highlightIndex: number | null;
  onHoverRoom: (index: number | null) => void;
  activeRoom: number | null;
  onSelectRoom: (index: number | null) => void;
  onMoveRoom: (index: number, bbox: [number, number, number, number]) => void;
}

interface LayoutInfo {
  rects: { x: number; y: number; w: number; h: number }[];
  scale: number;
  offsetX: number;
  offsetY: number;
  minX: number;
  minY: number;
}

export function FloorPlanCanvas({
  rooms,
  highlightIndex,
  onHoverRoom,
  activeRoom,
  onSelectRoom,
  onMoveRoom,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<LayoutInfo>({
    rects: [],
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    minX: 0,
    minY: 0,
  });

  // Drag state kept in refs to avoid re-renders during drag
  const dragRef = useRef<{
    index: number;
    startMx: number;
    startMy: number;
    origBbox: [number, number, number, number];
    moved: boolean;
  } | null>(null);
  const dragBboxRef = useRef<[number, number, number, number] | null>(null);
  const snapLinesRef = useRef<{ orientation: "h" | "v"; pos: number }[]>([]);

  const drawRooms = useCallback(
    (
      highlight: number | null,
      active: number | null,
      overrideBbox?: { index: number; bbox: [number, number, number, number] },
    ) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || rooms.length === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const containerWidth = container.clientWidth;
      const containerHeight = Math.max(400, Math.min(600, containerWidth * 0.7));

      canvas.width = containerWidth * dpr;
      canvas.height = containerHeight * dpr;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, containerWidth, containerHeight);

      // Build effective bboxes (with override for dragged room)
      const bboxes = rooms.map((room, i) =>
        overrideBbox && overrideBbox.index === i ? overrideBbox.bbox : room.bbox,
      );

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [ymin, xmin, ymax, xmax] of bboxes) {
        if (xmin < minX) minX = xmin;
        if (ymin < minY) minY = ymin;
        if (xmax > maxX) maxX = xmax;
        if (ymax > maxY) maxY = ymax;
      }

      const bboxW = maxX - minX || 1;
      const bboxH = maxY - minY || 1;
      const padding = 32;
      const drawW = containerWidth - padding * 2;
      const drawH = containerHeight - padding * 2;
      const scale = Math.min(drawW / bboxW, drawH / bboxH);
      const offsetX = padding + (drawW - bboxW * scale) / 2;
      const offsetY = padding + (drawH - bboxH * scale) / 2;

      const rects: { x: number; y: number; w: number; h: number }[] = [];

      rooms.forEach((room, i) => {
        const color = ROOM_COLORS[i % ROOM_COLORS.length];
        const [ymin, xmin, ymax, xmax] = bboxes[i];

        const x = offsetX + (xmin - minX) * scale;
        const y = offsetY + (ymin - minY) * scale;
        const w = (xmax - xmin) * scale;
        const h = (ymax - ymin) * scale;
        rects.push({ x, y, w, h });

        const isDragging = dragRef.current?.index === i && dragRef.current.moved;
        const isActive = active === i;
        const isHighlighted = highlight === i;
        const isDimmed = highlight !== null && !isHighlighted && !isActive;

        ctx.fillStyle = isDragging
          ? color.border.replace("0.6)", "0.3)")
          : isActive
            ? color.border.replace("0.6)", "0.25)")
            : isHighlighted
              ? color.border.replace("0.6)", "0.35)")
              : isDimmed
                ? "rgba(200,200,200,0.08)"
                : color.bg;
        ctx.fillRect(x, y, w, h);

        if (isActive) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(x, y, w, h);
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = isDimmed
            ? "rgba(160,160,160,0.25)"
            : color.border;
          ctx.lineWidth = isDragging ? 3 : isHighlighted ? 3 : 2;
          ctx.strokeRect(x, y, w, h);
        }

        const textAlpha = isDimmed ? 0.25 : 1;
        const nameSize = Math.max(11, Math.min(16, Math.min(w, h) / 6));
        const areaSize = Math.max(13, Math.min(22, Math.min(w, h) / 4.5));
        const dimSize = Math.max(9, Math.min(13, Math.min(w, h) / 7));
        const cx = x + w / 2;
        const cy = y + h / 2;

        ctx.globalAlpha = textAlpha;
        ctx.fillStyle = color.text;
        ctx.font = `600 ${nameSize}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(room.name, cx, cy - areaSize * 0.7);

        ctx.font = `700 ${areaSize}px Arial, sans-serif`;
        ctx.fillText(`${room.area} m²`, cx, cy + nameSize * 0.3);

        ctx.fillStyle = color.border;
        ctx.font = `${dimSize}px Arial, sans-serif`;
        ctx.fillText(`${room.width}m × ${room.height}m`, cx, cy + nameSize * 0.3 + areaSize * 0.9);

        ctx.globalAlpha = 1;
      });

      // Draw measurement labels between adjacent rooms
      const adjacencyThreshold = 0.5; // bbox units
      for (let i = 0; i < bboxes.length; i++) {
        for (let j = i + 1; j < bboxes.length; j++) {
          const [aymin, axmin, aymax, axmax] = bboxes[i];
          const [bymin, bxmin, bymax, bxmax] = bboxes[j];

          // Vertical shared wall: a.xmax ≈ b.xmin or a.xmin ≈ b.xmax
          const vPairs: [number, number][] = [];
          if (Math.abs(axmax - bxmin) < adjacencyThreshold) vPairs.push([axmax, axmax]);
          if (Math.abs(axmin - bxmax) < adjacencyThreshold) vPairs.push([axmin, axmin]);

          for (const [wallX] of vPairs) {
            const overlapMin = Math.max(aymin, bymin);
            const overlapMax = Math.min(aymax, bymax);
            if (overlapMax - overlapMin < adjacencyThreshold) continue;

            const sx = offsetX + (wallX - minX) * scale;
            const sy1 = offsetY + (overlapMin - minY) * scale;
            const sy2 = offsetY + (overlapMax - minY) * scale;
            const wallLen = overlapMax - overlapMin;

            // Find real-world length: use room heights proportionally
            const roomA = rooms[i];
            const bboxAH = aymax - aymin;
            const realLen = bboxAH > 0 ? (wallLen / bboxAH) * roomA.height : wallLen;

            ctx.save();
            ctx.strokeStyle = "rgba(113,113,122,0.4)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy1 + 4);
            ctx.lineTo(sx, sy2 - 4);
            ctx.stroke();
            // End ticks
            ctx.beginPath();
            ctx.moveTo(sx - 3, sy1 + 4);
            ctx.lineTo(sx + 3, sy1 + 4);
            ctx.moveTo(sx - 3, sy2 - 4);
            ctx.lineTo(sx + 3, sy2 - 4);
            ctx.stroke();

            const labelY = (sy1 + sy2) / 2;
            const label = `${realLen.toFixed(1)}m`;
            const fontSize = Math.max(9, Math.min(11, (sy2 - sy1) / 4));
            ctx.font = `500 ${fontSize}px Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const textW = ctx.measureText(label).width + 6;
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.fillRect(sx - textW / 2, labelY - fontSize / 2 - 2, textW, fontSize + 4);
            ctx.fillStyle = "rgba(113,113,122,0.8)";
            ctx.fillText(label, sx, labelY);
            ctx.restore();
          }

          // Horizontal shared wall: a.ymax ≈ b.ymin or a.ymin ≈ b.ymax
          const hPairs: [number, number][] = [];
          if (Math.abs(aymax - bymin) < adjacencyThreshold) hPairs.push([aymax, aymax]);
          if (Math.abs(aymin - bymax) < adjacencyThreshold) hPairs.push([aymin, aymin]);

          for (const [wallY] of hPairs) {
            const overlapMin = Math.max(axmin, bxmin);
            const overlapMax = Math.min(axmax, bxmax);
            if (overlapMax - overlapMin < adjacencyThreshold) continue;

            const sy = offsetY + (wallY - minY) * scale;
            const sx1 = offsetX + (overlapMin - minX) * scale;
            const sx2 = offsetX + (overlapMax - minX) * scale;
            const wallLen = overlapMax - overlapMin;

            const roomA = rooms[i];
            const bboxAW = axmax - axmin;
            const realLen = bboxAW > 0 ? (wallLen / bboxAW) * roomA.width : wallLen;

            ctx.save();
            ctx.strokeStyle = "rgba(113,113,122,0.4)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx1 + 4, sy);
            ctx.lineTo(sx2 - 4, sy);
            ctx.stroke();
            // End ticks
            ctx.beginPath();
            ctx.moveTo(sx1 + 4, sy - 3);
            ctx.lineTo(sx1 + 4, sy + 3);
            ctx.moveTo(sx2 - 4, sy - 3);
            ctx.lineTo(sx2 - 4, sy + 3);
            ctx.stroke();

            const labelX = (sx1 + sx2) / 2;
            const label = `${realLen.toFixed(1)}m`;
            const fontSize = Math.max(9, Math.min(11, (sx2 - sx1) / 4));
            ctx.font = `500 ${fontSize}px Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const textW = ctx.measureText(label).width + 6;
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.fillRect(labelX - textW / 2, sy - fontSize / 2 - 2, textW, fontSize + 4);
            ctx.fillStyle = "rgba(113,113,122,0.8)";
            ctx.fillText(label, labelX, sy);
            ctx.restore();
          }
        }
      }

      // Draw snap lines
      const snapLines = snapLinesRef.current;
      if (snapLines.length > 0 && dragRef.current?.moved) {
        ctx.save();
        ctx.strokeStyle = "rgba(59,130,246,0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        for (const line of snapLines) {
          const screenPos = line.orientation === "v"
            ? offsetX + (line.pos - minX) * scale
            : offsetY + (line.pos - minY) * scale;
          ctx.beginPath();
          if (line.orientation === "v") {
            ctx.moveTo(screenPos, 0);
            ctx.lineTo(screenPos, containerHeight);
          } else {
            ctx.moveTo(0, screenPos);
            ctx.lineTo(containerWidth, screenPos);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      layoutRef.current = { rects, scale, offsetX, offsetY, minX, minY };
    },
    [rooms],
  );

  useEffect(() => {
    drawRooms(highlightIndex, activeRoom);
  }, [drawRooms, highlightIndex, activeRoom]);

  const hitTest = useCallback((mx: number, my: number): number | null => {
    const { rects } = layoutRef.current;
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        return i;
      }
    }
    return null;
  }, []);

  const snapBbox = useCallback(
    (
      dragIndex: number,
      bbox: [number, number, number, number],
    ): { bbox: [number, number, number, number]; lines: { orientation: "h" | "v"; pos: number }[] } => {
      const [ymin, xmin, ymax, xmax] = bbox;
      const { scale } = layoutRef.current;
      const threshold = SNAP_PX / scale;

      let dx = 0;
      let dy = 0;
      const lines: { orientation: "h" | "v"; pos: number }[] = [];

      const dragEdgesX = [xmin, xmax];
      const dragEdgesY = [ymin, ymax];

      let bestDx = Infinity;
      let bestDy = Infinity;

      for (let i = 0; i < rooms.length; i++) {
        if (i === dragIndex) continue;
        const [oymin, oxmin, oymax, oxmax] = rooms[i].bbox;
        const otherEdgesX = [oxmin, oxmax];
        const otherEdgesY = [oymin, oymax];

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

      const snappedBbox: [number, number, number, number] = [
        ymin + dy,
        xmin + dx,
        ymax + dy,
        xmax + dx,
      ];

      // Collect visible snap lines
      if (dx !== 0) {
        const snappedEdgesX = [xmin + dx, xmax + dx];
        for (const se of snappedEdgesX) {
          for (let i = 0; i < rooms.length; i++) {
            if (i === dragIndex) continue;
            const [, oxmin, , oxmax] = rooms[i].bbox;
            if (Math.abs(se - oxmin) < threshold * 0.1) lines.push({ orientation: "v", pos: se });
            if (Math.abs(se - oxmax) < threshold * 0.1) lines.push({ orientation: "v", pos: se });
          }
        }
      }
      if (dy !== 0) {
        const snappedEdgesY = [ymin + dy, ymax + dy];
        for (const se of snappedEdgesY) {
          for (let i = 0; i < rooms.length; i++) {
            if (i === dragIndex) continue;
            const [oymin, , oymax] = rooms[i].bbox;
            if (Math.abs(se - oymin) < threshold * 0.1) lines.push({ orientation: "h", pos: se });
            if (Math.abs(se - oymax) < threshold * 0.1) lines.push({ orientation: "h", pos: se });
          }
        }
      }

      return { bbox: snappedBbox, lines };
    },
    [rooms],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const found = hitTest(mx, my);
      if (found !== null) {
        e.preventDefault();
        dragRef.current = {
          index: found,
          startMx: mx,
          startMy: my,
          origBbox: [...rooms[found].bbox],
          moved: false,
        };
        dragBboxRef.current = null;
        snapLinesRef.current = [];
      }
    },
    [hitTest, rooms],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const drag = dragRef.current;
      if (drag) {
        const dxPx = mx - drag.startMx;
        const dyPx = my - drag.startMy;

        if (!drag.moved && Math.abs(dxPx) < 4 && Math.abs(dyPx) < 4) return;
        drag.moved = true;

        const { scale } = layoutRef.current;
        const dxBbox = dxPx / scale;
        const dyBbox = dyPx / scale;
        const [ymin, xmin, ymax, xmax] = drag.origBbox;
        const rawBbox: [number, number, number, number] = [
          ymin + dyBbox,
          xmin + dxBbox,
          ymax + dyBbox,
          xmax + dxBbox,
        ];

        const { bbox: snapped, lines } = snapBbox(drag.index, rawBbox);
        dragBboxRef.current = snapped;
        snapLinesRef.current = lines;
        drawRooms(null, activeRoom, { index: drag.index, bbox: snapped });
        return;
      }

      // Normal hover
      onHoverRoom(hitTest(mx, my));
    },
    [hitTest, onHoverRoom, snapBbox, drawRooms, activeRoom],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.moved && dragBboxRef.current) {
        onMoveRoom(drag.index, dragBboxRef.current);
      } else {
        // It was a click, not a drag
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const found = hitTest(mx, my);
          onSelectRoom(found === activeRoom ? null : found);
        }
      }

      dragRef.current = null;
      dragBboxRef.current = null;
      snapLinesRef.current = [];
      drawRooms(highlightIndex, activeRoom);
    },
    [onMoveRoom, onSelectRoom, activeRoom, hitTest, drawRooms, highlightIndex],
  );

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current?.moved && dragBboxRef.current) {
      onMoveRoom(dragRef.current.index, dragBboxRef.current);
    }
    dragRef.current = null;
    dragBboxRef.current = null;
    snapLinesRef.current = [];
    onHoverRoom(null);
    drawRooms(highlightIndex, activeRoom);
  }, [onHoverRoom, onMoveRoom, drawRooms, highlightIndex, activeRoom]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
    >
      <canvas
        ref={canvasRef}
        className="w-full block cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
