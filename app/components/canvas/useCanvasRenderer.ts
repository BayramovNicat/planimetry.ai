import { useCallback, useRef } from "react";

import type { Room } from "../../types";
import type {
  Bbox,
  Connection,
  ConnectPreview,
  LayoutInfo,
  OverrideBox,
  SnapLine,
  SplitPreview,
} from "./canvasTypes";
import {
  drawConnectionCircles,
  drawConnectionPreview,
  drawConnections,
  drawMeasurementLabels,
  drawResizeHandles,
  drawRoomFillsAndBorders,
  drawRoomLabels,
  drawSnapLines,
  drawSplitPreview,
} from "./drawHelpers";

/**
 * Manages the canvas rendering pipeline:
 * sizing, layout computation, and orchestrating all draw helpers.
 */
export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  normalizedRooms: Room[],
) {
  const layoutRef = useRef<LayoutInfo>({
    rects: [],
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    minX: 0,
    minY: 0,
  });

  const drawRooms = useCallback(
    (
      highlight: number | null,
      active: number | null,
      overrideBox?: OverrideBox,
      opts?: {
        dragIndex?: number;
        dragMoved?: boolean;
        snapLines?: SnapLine[];
        splitPreview?: SplitPreview | null;
        connectMode?: boolean;
        connections?: Connection[];
        connectPreview?: ConnectPreview | null;
        connectHoverIndex?: number | null;
      },
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
      const bboxes: Bbox[] = normalizedRooms.map((room, i) =>
        overrideBox && overrideBox.index === i ? overrideBox.bbox : room.bbox,
      );

      // Build effective subRects (translate by same delta as overrideBox)
      const effectiveSubRects: (Bbox[] | undefined)[] = normalizedRooms.map((room, i) => {
        if (!room.subRects) return undefined;
        if (overrideBox && overrideBox.index === i) {
          const dy = overrideBox.bbox[0] - room.bbox[0];
          const dx = overrideBox.bbox[1] - room.bbox[1];
          return room.subRects.map((r) => [r[0] + dy, r[1] + dx, r[2] + dy, r[3] + dx] as Bbox);
        }
        return room.subRects;
      });

      // Compute bounds
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (let i = 0; i < bboxes.length; i++) {
        const subs = effectiveSubRects[i];
        const toCheck = subs ?? [bboxes[i]];
        for (const [ymin, xmin, ymax, xmax] of toCheck) {
          if (xmin < minX) minX = xmin;
          if (ymin < minY) minY = ymin;
          if (xmax > maxX) maxX = xmax;
          if (ymax > maxY) maxY = ymax;
        }
      }

      const bboxW = maxX - minX || 1;
      const bboxH = maxY - minY || 1;
      const padding = 32;
      const drawW = containerWidth - padding * 2;
      const drawH = containerHeight - padding * 2;
      const scale = Math.min(drawW / bboxW, drawH / bboxH);
      const offsetX = padding + (drawW - bboxW * scale) / 2;
      const offsetY = padding + (drawH - bboxH * scale) / 2;

      const rects = normalizedRooms.map((_room, i) => {
        const [ymin, xmin, ymax, xmax] = bboxes[i];
        return {
          x: offsetX + (xmin - minX) * scale,
          y: offsetY + (ymin - minY) * scale,
          w: (xmax - xmin) * scale,
          h: (ymax - ymin) * scale,
        };
      });

      const dc = {
        ctx,
        containerWidth,
        containerHeight,
        scale,
        offsetX,
        offsetY,
        minX,
        minY,
      };

      // 1. Room fills & borders
      drawRoomFillsAndBorders(
        dc,
        normalizedRooms,
        bboxes,
        effectiveSubRects,
        rects,
        highlight,
        active,
        (i: number) => opts?.dragIndex === i && (opts?.dragMoved ?? false),
      );

      if (opts?.connectMode) {
        // Connect mode: show circles instead of labels
        if (opts?.connections) {
          drawConnections(ctx, opts.connections, rects);
        }
        drawConnectionCircles(ctx, normalizedRooms, rects, opts?.connectHoverIndex ?? null);
        if (opts?.connectPreview) {
          drawConnectionPreview(ctx, opts.connectPreview);
        }
      } else {
        // 2. Room labels
        drawRoomLabels(ctx, normalizedRooms, rects, highlight, active, overrideBox);

        // 3. Measurement labels
        drawMeasurementLabels(dc, normalizedRooms, bboxes, effectiveSubRects);

        // 4. Snap lines
        if (opts?.snapLines) {
          drawSnapLines(dc, opts.snapLines, opts?.dragMoved ?? false);
        }

        // 5. Split preview
        if (opts?.splitPreview && active !== null) {
          const activeRect = rects[active];
          if (activeRect) {
            drawSplitPreview(dc, opts.splitPreview, activeRect);
          }
        }

        // 6. Resize handles (skip for composite rooms)
        if (active !== null && !effectiveSubRects[active]) {
          const activeRect = rects[active];
          if (activeRect) {
            drawResizeHandles(ctx, activeRect);
          }
        }
      }

      layoutRef.current = { rects, scale, offsetX, offsetY, minX, minY };
    },
    [normalizedRooms, canvasRef, containerRef],
  );

  return { layoutRef, drawRooms };
}
