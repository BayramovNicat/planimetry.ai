"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
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
  onUpdateRoom?: (index: number, data: Partial<Room>) => void;
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
  onUpdateRoom,
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

  const normalizedRooms = useMemo(() => {
    if (rooms.length === 0) return [];

    // Compute a global pxPerM from the median of all rooms (more robust than just first)
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
    const pxPerM = ratios.length > 0
      ? ratios[Math.floor(ratios.length / 2)]
      : 100;

    // Rebuild each bbox centered on its AI-given center, sized by real-world dimensions
    return rooms.map(room => {
      const [ymin, xmin, ymax, xmax] = room.bbox;
      const cx = (xmin + xmax) / 2;
      const cy = (ymin + ymax) / 2;
      const halfW = (room.width * pxPerM) / 2;
      const halfH = (room.height * pxPerM) / 2;
      return {
        ...room,
        bbox: [
          cy - halfH,
          cx - halfW,
          cy + halfH,
          cx + halfW,
        ] as [number, number, number, number],
      };
    });
  }, [rooms]);

  // Drag state kept in refs to avoid re-renders during drag
  const dragRef = useRef<{
    index: number;
    type: "move" | "resize";
    side?: "top" | "bottom" | "left" | "right";
    startMx: number;
    startMy: number;
    origBbox: [number, number, number, number];
    origWidth: number;
    origHeight: number;
    moved: boolean;
  } | null>(null);
  const dragBboxRef = useRef<[number, number, number, number] | null>(null);
  const dragSizeRef = useRef<{ w: number; h: number } | null>(null);
  const snapLinesRef = useRef<{ orientation: "h" | "v"; pos: number }[]>([]);

  const drawRooms = useCallback(
    (
      highlight: number | null,
      active: number | null,
      overrideBox?: { index: number; bbox: [number, number, number, number]; isResize?: boolean; tempW?: number; tempH?: number },
    ) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || normalizedRooms.length === 0) return;

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
      const bboxes = normalizedRooms.map((room, i) =>
        overrideBox && overrideBox.index === i ? overrideBox.bbox : room.bbox,
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

      normalizedRooms.forEach((room, i) => {
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

        const rw = overrideBox?.index === i && overrideBox.isResize && overrideBox.tempW ? overrideBox.tempW : room.width;
        const rh = overrideBox?.index === i && overrideBox.isResize && overrideBox.tempH ? overrideBox.tempH : room.height;

        ctx.fillStyle = color.border;
        ctx.font = `${dimSize}px Arial, sans-serif`;
        ctx.fillText(`${rw.toFixed(1)} × ${rh.toFixed(1)}`, cx, cy + nameSize * 0.3 + areaSize * 0.9);

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
            const roomA = normalizedRooms[i];
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

            const roomA = normalizedRooms[i];
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

      // Draw drag corners if active
      if (active !== null) {
        const activeRect = rects[active];
        if (activeRect) {
          const H_SIZE = 10;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          const drawHandle = (hx: number, hy: number) => {
            ctx.fillRect(hx - H_SIZE / 2, hy - H_SIZE / 2, H_SIZE, H_SIZE);
            ctx.strokeRect(hx - H_SIZE / 2, hy - H_SIZE / 2, H_SIZE, H_SIZE);
          };
          // Draw side handles instead of corners
          drawHandle(activeRect.x + activeRect.w / 2, activeRect.y);
          drawHandle(activeRect.x + activeRect.w, activeRect.y + activeRect.h / 2);
          drawHandle(activeRect.x + activeRect.w / 2, activeRect.y + activeRect.h);
          drawHandle(activeRect.x, activeRect.y + activeRect.h / 2);
        }
      }

      layoutRef.current = { rects, scale, offsetX, offsetY, minX, minY };
    },
    [normalizedRooms],
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

      for (let i = 0; i < normalizedRooms.length; i++) {
        if (i === dragIndex) continue;
        const [oymin, oxmin, oymax, oxmax] = normalizedRooms[i].bbox;
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

      if (dx !== 0) {
        const snappedEdgesX = [xmin + dx, xmax + dx];
        for (const se of snappedEdgesX) {
          for (let i = 0; i < normalizedRooms.length; i++) {
            if (i === dragIndex) continue;
            const [, oxmin, , oxmax] = normalizedRooms[i].bbox;
            if (Math.abs(se - oxmin) < threshold * 0.1) lines.push({ orientation: "v", pos: se });
            if (Math.abs(se - oxmax) < threshold * 0.1) lines.push({ orientation: "v", pos: se });
          }
        }
      }
      if (dy !== 0) {
        const snappedEdgesY = [ymin + dy, ymax + dy];
        for (const se of snappedEdgesY) {
          for (let i = 0; i < normalizedRooms.length; i++) {
            if (i === dragIndex) continue;
            const [oymin, , oymax] = normalizedRooms[i].bbox;
            if (Math.abs(se - oymin) < threshold * 0.1) lines.push({ orientation: "h", pos: se });
            if (Math.abs(se - oymax) < threshold * 0.1) lines.push({ orientation: "h", pos: se });
          }
        }
      }

      return { bbox: snappedBbox, lines };
    },
    [normalizedRooms],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const { rects } = layoutRef.current;

      // Hit test handles first
      if (activeRoom !== null && activeRoom < normalizedRooms.length) {
        const activeRect = rects[activeRoom];
        if (activeRect) {
          const H_SIZE = 12; // slightly larger hit area
          const handles = [
            { side: "top" as const, x: activeRect.x + activeRect.w / 2, y: activeRect.y },
            { side: "right" as const, x: activeRect.x + activeRect.w, y: activeRect.y + activeRect.h / 2 },
            { side: "bottom" as const, x: activeRect.x + activeRect.w / 2, y: activeRect.y + activeRect.h },
            { side: "left" as const, x: activeRect.x, y: activeRect.y + activeRect.h / 2 },
          ];
          for (const h of handles) {
            if (Math.abs(mx - h.x) <= H_SIZE && Math.abs(my - h.y) <= H_SIZE) {
              e.preventDefault();
              const nRoom = normalizedRooms[activeRoom];
              dragRef.current = {
                index: activeRoom,
                type: "resize",
                side: h.side,
                startMx: mx,
                startMy: my,
                origBbox: [...nRoom.bbox],
                origWidth: nRoom.width,
                origHeight: nRoom.height,
                moved: false,
              };
              dragBboxRef.current = null;
              dragSizeRef.current = null;
              snapLinesRef.current = [];
              return;
            }
          }
        }
      }

      const found = hitTest(mx, my);
      if (found !== null) {
        e.preventDefault();
        const nRoom = normalizedRooms[found];
        dragRef.current = {
          index: found,
          type: "move",
          startMx: mx,
          startMy: my,
          origBbox: [...nRoom.bbox],
          origWidth: nRoom.width,
          origHeight: nRoom.height,
          moved: false,
        };
        dragBboxRef.current = null;
        dragSizeRef.current = null;
        snapLinesRef.current = [];
      }
    },
    [hitTest, normalizedRooms, activeRoom],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const drag = dragRef.current;

      if (drag && drag.type === "resize" && drag.side) {
        if (drag.side === "left" || drag.side === "right") {
          canvas.style.cursor = "ew-resize";
        } else if (drag.side === "top" || drag.side === "bottom") {
          canvas.style.cursor = "ns-resize";
        }
      } else if (drag && drag.type === "move") {
         canvas.style.cursor = "grabbing";
      }

      if (drag) {
        const dxPx = mx - drag.startMx;
        const dyPx = my - drag.startMy;

        if (!drag.moved && Math.abs(dxPx) < 4 && Math.abs(dyPx) < 4) return;
        drag.moved = true;

        if (drag.type === "resize" && drag.side) {
          const room = normalizedRooms[drag.index];
          const origBboxW = drag.origBbox[3] - drag.origBbox[1];
          const origBboxH = drag.origBbox[2] - drag.origBbox[0];
          const pxPerM = drag.origWidth > 0 ? origBboxW / drag.origWidth : 100;

          const { scale } = layoutRef.current;
          const dBbox = { x: dxPx / scale, y: dyPx / scale };

          // Compute raw moving edge position
          const [orig_ymin, orig_xmin, orig_ymax, orig_xmax] = drag.origBbox;
          let movingEdge: number;
          let orientation: "v" | "h";

          if (drag.side === "right") {
            movingEdge = orig_xmax + dBbox.x;
            orientation = "v";
          } else if (drag.side === "left") {
            movingEdge = orig_xmin + dBbox.x;
            orientation = "v";
          } else if (drag.side === "bottom") {
            movingEdge = orig_ymax + dBbox.y;
            orientation = "h";
          } else {
            movingEdge = orig_ymin + dBbox.y;
            orientation = "h";
          }

          // Snap moving edge to other rooms' edges
          const snapThreshold = SNAP_PX / scale;
          let snappedEdge = movingEdge;
          let bestDist = Infinity;
          const lines: { orientation: "h" | "v"; pos: number }[] = [];

          for (let i = 0; i < normalizedRooms.length; i++) {
            if (i === drag.index) continue;
            const [oymin, oxmin, oymax, oxmax] = normalizedRooms[i].bbox;
            const targets = orientation === "v" ? [oxmin, oxmax] : [oymin, oymax];
            for (const t of targets) {
              const dist = Math.abs(movingEdge - t);
              if (dist < snapThreshold && dist < bestDist) {
                bestDist = dist;
                snappedEdge = t;
              }
            }
          }

          if (bestDist < snapThreshold) {
            lines.push({ orientation, pos: snappedEdge });
          }

          // Derive new dimensions from snapped edge
          let newW: number;
          let newH: number;

          if (drag.side === "right") {
            newW = Math.max(0.2, (snappedEdge - orig_xmin) / pxPerM);
            newH = room.area / newW;
          } else if (drag.side === "left") {
            newW = Math.max(0.2, (orig_xmax - snappedEdge) / pxPerM);
            newH = room.area / newW;
          } else if (drag.side === "bottom") {
            newH = Math.max(0.2, (snappedEdge - orig_ymin) / pxPerM);
            newW = room.area / newH;
          } else {
            newH = Math.max(0.2, (orig_ymax - snappedEdge) / pxPerM);
            newW = room.area / newH;
          }

          newW = Math.round(newW * 100) / 100;
          newH = Math.round(newH * 100) / 100;

          let new_xmin = orig_xmin;
          let new_ymin = orig_ymin;

          // Anchor the opposite edge, center the orthogonal axis
          if (drag.side === "right") {
            new_xmin = orig_xmin;
            new_ymin = orig_ymin + (origBboxH - newH * pxPerM) / 2;
          } else if (drag.side === "left") {
            new_xmin = orig_xmax - newW * pxPerM;
            new_ymin = orig_ymin + (origBboxH - newH * pxPerM) / 2;
          } else if (drag.side === "bottom") {
            new_ymin = orig_ymin;
            new_xmin = orig_xmin + (origBboxW - newW * pxPerM) / 2;
          } else if (drag.side === "top") {
            new_ymin = orig_ymax - newH * pxPerM;
            new_xmin = orig_xmin + (origBboxW - newW * pxPerM) / 2;
          }

          const newBbox: [number, number, number, number] = [
            new_ymin,
            new_xmin,
            new_ymin + newH * pxPerM,
            new_xmin + newW * pxPerM,
          ];

          dragBboxRef.current = newBbox;
          dragSizeRef.current = { w: newW, h: newH };
          snapLinesRef.current = lines;

          drawRooms(null, activeRoom, { index: drag.index, bbox: newBbox, isResize: true, tempW: newW, tempH: newH });
          return;
        }

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
      const foundRoom = hitTest(mx, my);
      onHoverRoom(foundRoom);

      // Check handle hover for cursor if not dragging
      if (!drag) {
        let overHandle = false;
        const { rects } = layoutRef.current;
        if (activeRoom !== null) {
          const activeRect = rects[activeRoom];
          if (activeRect) {
            const H_SIZE = 12;
            const handles = [
              { side: "top" as const, x: activeRect.x + activeRect.w / 2, y: activeRect.y },
              { side: "right" as const, x: activeRect.x + activeRect.w, y: activeRect.y + activeRect.h / 2 },
              { side: "bottom" as const, x: activeRect.x + activeRect.w / 2, y: activeRect.y + activeRect.h },
              { side: "left" as const, x: activeRect.x, y: activeRect.y + activeRect.h / 2 },
            ];
            for (const h of handles) {
              if (Math.abs(mx - h.x) <= H_SIZE && Math.abs(my - h.y) <= H_SIZE) {
                overHandle = true;
                if (h.side === "left" || h.side === "right") {
                  canvas.style.cursor = "ew-resize";
                } else if (h.side === "top" || h.side === "bottom") {
                  canvas.style.cursor = "ns-resize";
                }
                break;
              }
            }
          }
        }
        if (!overHandle) {
          if (foundRoom !== null) {
              canvas.style.cursor = "grab";
          } else {
              canvas.style.cursor = "crosshair"; // default
          }
        }
      }
    },
    [hitTest, onHoverRoom, snapBbox, drawRooms, activeRoom, normalizedRooms],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) {
        // Clicked on empty canvas — deselect active room
        if (activeRoom !== null) {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            if (hitTest(mx, my) === null) {
              onSelectRoom(null);
            }
          }
        }
        return;
      }

      if (drag.moved && dragBboxRef.current) {
        if (drag.type === "resize" && dragSizeRef.current && onUpdateRoom) {
          onUpdateRoom(drag.index, { 
            width: dragSizeRef.current.w, 
            height: dragSizeRef.current.h, 
            bbox: dragBboxRef.current 
          });
        } else {
          onMoveRoom(drag.index, dragBboxRef.current);
        }
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
      dragSizeRef.current = null;
      snapLinesRef.current = [];

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const found = hitTest(mx, my);
        canvas.style.cursor = found !== null ? "grab" : "crosshair"; 
      }

      drawRooms(highlightIndex, activeRoom);
    },
    [onMoveRoom, onSelectRoom, activeRoom, hitTest, drawRooms, highlightIndex, onUpdateRoom],
  );

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current?.moved && dragBboxRef.current) {
      if (dragRef.current.type === "resize" && dragSizeRef.current && onUpdateRoom) {
        onUpdateRoom(dragRef.current.index, { 
          width: dragSizeRef.current.w, 
          height: dragSizeRef.current.h, 
          bbox: dragBboxRef.current 
        });
      } else {
        onMoveRoom(dragRef.current.index, dragBboxRef.current);
      }
    }
    dragRef.current = null;
    dragBboxRef.current = null;
    dragSizeRef.current = null;
    snapLinesRef.current = [];
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "crosshair";
    }

    onHoverRoom(null);
    drawRooms(highlightIndex, activeRoom);
  }, [onHoverRoom, onMoveRoom, drawRooms, highlightIndex, activeRoom, onUpdateRoom]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
    >
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ cursor: "pointer" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
