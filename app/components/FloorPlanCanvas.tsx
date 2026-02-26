"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Room } from "../types";
import { ROOM_COLORS } from "../constants";

interface FloorPlanCanvasProps {
  rooms: Room[];
  highlightIndex: number | null;
  onHoverRoom: (index: number | null) => void;
}

export function FloorPlanCanvas({ rooms, highlightIndex, onHoverRoom }: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<{
    rects: { x: number; y: number; w: number; h: number }[];
  }>({ rects: [] });

  const draw = useCallback(
    (highlight: number | null) => {
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

      let minX = 1000, minY = 1000, maxX = 0, maxY = 0;
      for (const room of rooms) {
        const [ymin, xmin, ymax, xmax] = room.bbox;
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
        const [ymin, xmin, ymax, xmax] = room.bbox;

        const x = offsetX + (xmin - minX) * scale;
        const y = offsetY + (ymin - minY) * scale;
        const w = (xmax - xmin) * scale;
        const h = (ymax - ymin) * scale;
        rects.push({ x, y, w, h });

        const isHighlighted = highlight === i;
        const isDimmed = highlight !== null && !isHighlighted;

        ctx.fillStyle = isHighlighted
          ? color.border.replace("0.6)", "0.35)")
          : isDimmed
            ? "rgba(200,200,200,0.08)"
            : color.bg;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = isDimmed
          ? "rgba(160,160,160,0.25)"
          : color.border;
        ctx.lineWidth = isHighlighted ? 3 : 2;
        ctx.strokeRect(x, y, w, h);

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

        ctx.strokeStyle = color.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        const lineY2 = y + 14;
        ctx.beginPath();
        ctx.moveTo(x + 4, lineY2);
        ctx.lineTo(x + w - 4, lineY2);
        ctx.stroke();

        const lineX2 = x + 10;
        ctx.beginPath();
        ctx.moveTo(lineX2, y + 4);
        ctx.lineTo(lineX2, y + h - 4);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 1;
      });

      layoutRef.current = { rects };
    },
    [rooms],
  );

  useEffect(() => {
    draw(highlightIndex);
  }, [draw, highlightIndex]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const { rects } = layoutRef.current;
      let found: number | null = null;
      for (let i = rects.length - 1; i >= 0; i--) {
        const r = rects[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          found = i;
          break;
        }
      }
      onHoverRoom(found);
    },
    [onHoverRoom],
  );

  const handleMouseLeave = useCallback(() => {
    onHoverRoom(null);
  }, [onHoverRoom]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
    >
      <canvas
        ref={canvasRef}
        className="w-full block cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
