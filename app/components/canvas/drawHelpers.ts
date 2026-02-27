import type {
  Room,
  Bbox,
  ScreenRect,
  SnapLine,
  SplitPreview,
  OverrideBox,
} from "./canvasTypes";
import { ROOM_COLORS } from "../../constants";

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  containerWidth: number;
  containerHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  minX: number;
  minY: number;
}

// ─── Room fills & borders ────────────────────────────────────────────

export function drawRoomFillsAndBorders(
  dc: DrawContext,
  rooms: Room[],
  bboxes: Bbox[],
  effectiveSubRects: (Bbox[] | undefined)[],
  rects: ScreenRect[],
  highlight: number | null,
  active: number | null,
  isDraggingFn: (i: number) => boolean,
) {
  const { ctx, scale, offsetX, offsetY, minX, minY } = dc;

  rooms.forEach((room, i) => {
    const color = ROOM_COLORS[i % ROOM_COLORS.length];
    const rect = rects[i];

    const isDragging = isDraggingFn(i);
    const isActive = active === i;
    const isHighlighted = highlight === i;
    const isDimmed = highlight !== null && !isHighlighted && !isActive;

    const fillColor = isDragging
      ? color.border.replace("0.6)", "0.3)")
      : isActive
        ? color.border.replace("0.6)", "0.25)")
        : isHighlighted
          ? color.border.replace("0.6)", "0.35)")
          : isDimmed
            ? "rgba(200,200,200,0.08)"
            : color.bg;

    const subs = effectiveSubRects[i];
    const drawBoxes = subs
      ? subs.map(([sy, sx, sy2, sx2]) => ({
          x: offsetX + (sx - minX) * scale,
          y: offsetY + (sy - minY) * scale,
          w: (sx2 - sx) * scale,
          h: (sy2 - sy) * scale,
        }))
      : [{ x: rect.x, y: rect.y, w: rect.w, h: rect.h }];

    for (let bi = 0; bi < drawBoxes.length; bi++) {
      const box = drawBoxes[bi];
      ctx.fillStyle = fillColor;
      ctx.fillRect(box.x, box.y, box.w, box.h);

      if (isActive) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
      } else {
        ctx.strokeStyle = isDimmed ? "rgba(160,160,160,0.25)" : color.border;
        ctx.lineWidth = isDragging ? 3 : isHighlighted ? 3 : 2;
      }

      if (drawBoxes.length === 1) {
        ctx.strokeRect(box.x, box.y, box.w, box.h);
      } else {
        drawCompositeEdges(ctx, box, drawBoxes, bi);
      }

      if (isActive) ctx.setLineDash([]);
    }
  });
}

/** Draw edges of a composite sub-rect, skipping shared edges with siblings */
function drawCompositeEdges(
  ctx: CanvasRenderingContext2D,
  box: ScreenRect,
  drawBoxes: ScreenRect[],
  bi: number,
) {
  const eps = 1;
  const edges = [
    { dir: "top", x1: box.x, y1: box.y, x2: box.x + box.w, y2: box.y },
    {
      dir: "right",
      x1: box.x + box.w,
      y1: box.y,
      x2: box.x + box.w,
      y2: box.y + box.h,
    },
    {
      dir: "bottom",
      x1: box.x,
      y1: box.y + box.h,
      x2: box.x + box.w,
      y2: box.y + box.h,
    },
    { dir: "left", x1: box.x, y1: box.y, x2: box.x, y2: box.y + box.h },
  ];

  for (const edge of edges) {
    let shared = false;
    for (let bj = 0; bj < drawBoxes.length; bj++) {
      if (bj === bi) continue;
      const other = drawBoxes[bj];
      if (edge.dir === "top" || edge.dir === "bottom") {
        const matchY = edge.dir === "top" ? other.y + other.h : other.y;
        if (Math.abs(edge.y1 - matchY) < eps) {
          const overlapStart = Math.max(edge.x1, other.x);
          const overlapEnd = Math.min(edge.x2, other.x + other.w);
          if (overlapEnd - overlapStart > eps) {
            shared = true;
            if (overlapStart - edge.x1 > eps) {
              ctx.beginPath();
              ctx.moveTo(edge.x1, edge.y1);
              ctx.lineTo(overlapStart, edge.y1);
              ctx.stroke();
            }
            if (edge.x2 - overlapEnd > eps) {
              ctx.beginPath();
              ctx.moveTo(overlapEnd, edge.y1);
              ctx.lineTo(edge.x2, edge.y1);
              ctx.stroke();
            }
            break;
          }
        }
      } else {
        const matchX = edge.dir === "left" ? other.x + other.w : other.x;
        if (Math.abs(edge.x1 - matchX) < eps) {
          const overlapStart = Math.max(edge.y1, other.y);
          const overlapEnd = Math.min(edge.y2, other.y + other.h);
          if (overlapEnd - overlapStart > eps) {
            shared = true;
            if (overlapStart - edge.y1 > eps) {
              ctx.beginPath();
              ctx.moveTo(edge.x1, edge.y1);
              ctx.lineTo(edge.x1, overlapStart);
              ctx.stroke();
            }
            if (edge.y2 - overlapEnd > eps) {
              ctx.beginPath();
              ctx.moveTo(edge.x1, overlapEnd);
              ctx.lineTo(edge.x1, edge.y2);
              ctx.stroke();
            }
            break;
          }
        }
      }
    }

    if (!shared) {
      ctx.beginPath();
      ctx.moveTo(edge.x1, edge.y1);
      ctx.lineTo(edge.x2, edge.y2);
      ctx.stroke();
    }
  }
}

// ─── Room labels ─────────────────────────────────────────────────────

export function drawRoomLabels(
  ctx: CanvasRenderingContext2D,
  rooms: Room[],
  rects: ScreenRect[],
  highlight: number | null,
  active: number | null,
  overrideBox?: OverrideBox,
) {
  rooms.forEach((room, i) => {
    const color = ROOM_COLORS[i % ROOM_COLORS.length];
    const { x, y, w, h } = rects[i];
    const isHighlighted = highlight === i;
    const isActive = active === i;
    const isDimmed = highlight !== null && !isHighlighted && !isActive;
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

    const rw =
      overrideBox?.index === i && overrideBox.isResize && overrideBox.tempW
        ? overrideBox.tempW
        : room.width;
    const rh =
      overrideBox?.index === i && overrideBox.isResize && overrideBox.tempH
        ? overrideBox.tempH
        : room.height;

    ctx.fillStyle = color.border;
    ctx.font = `${dimSize}px Arial, sans-serif`;
    ctx.fillText(
      `${rw.toFixed(1)} × ${rh.toFixed(1)}`,
      cx,
      cy + nameSize * 0.3 + areaSize * 0.9,
    );

    ctx.globalAlpha = 1;
  });
}

// ─── Measurement labels ──────────────────────────────────────────────

export function drawMeasurementLabels(
  dc: DrawContext,
  rooms: Room[],
  bboxes: Bbox[],
  effectiveSubRects: (Bbox[] | undefined)[],
) {
  const { ctx, scale, offsetX, offsetY, minX, minY } = dc;
  const adjacencyThreshold = 0.5;
  const drawnLabels: { x: number; y: number }[] = [];

  for (let i = 0; i < bboxes.length; i++) {
    for (let j = i + 1; j < bboxes.length; j++) {
      const rectsI = effectiveSubRects[i] ?? [bboxes[i]];
      const rectsJ = effectiveSubRects[j] ?? [bboxes[j]];

      for (const [aymin, axmin, aymax, axmax] of rectsI) {
        for (const [bymin, bxmin, bymax, bxmax] of rectsJ) {
          // Vertical shared walls
          const vPairs: number[] = [];
          if (Math.abs(axmax - bxmin) < adjacencyThreshold) vPairs.push(axmax);
          if (Math.abs(axmin - bxmax) < adjacencyThreshold) vPairs.push(axmin);

          for (const wallX of vPairs) {
            const overlapMin = Math.max(aymin, bymin);
            const overlapMax = Math.min(aymax, bymax);
            if (overlapMax - overlapMin < adjacencyThreshold) continue;

            const sx = offsetX + (wallX - minX) * scale;
            const sy1 = offsetY + (overlapMin - minY) * scale;
            const sy2 = offsetY + (overlapMax - minY) * scale;
            const labelY = (sy1 + sy2) / 2;

            if (
              drawnLabels.some(
                (l) => Math.abs(l.x - sx) < 10 && Math.abs(l.y - labelY) < 10,
              )
            )
              continue;
            drawnLabels.push({ x: sx, y: labelY });

            const wallLen = overlapMax - overlapMin;
            const bboxAH = aymax - aymin;
            const realLen =
              bboxAH > 0 ? (wallLen / bboxAH) * rooms[i].height : wallLen;

            drawVerticalMeasurement(ctx, sx, sy1, sy2, labelY, realLen);
          }

          // Horizontal shared walls
          const hPairs: number[] = [];
          if (Math.abs(aymax - bymin) < adjacencyThreshold) hPairs.push(aymax);
          if (Math.abs(aymin - bymax) < adjacencyThreshold) hPairs.push(aymin);

          for (const wallY of hPairs) {
            const overlapMin = Math.max(axmin, bxmin);
            const overlapMax = Math.min(axmax, bxmax);
            if (overlapMax - overlapMin < adjacencyThreshold) continue;

            const sy = offsetY + (wallY - minY) * scale;
            const sx1 = offsetX + (overlapMin - minX) * scale;
            const sx2 = offsetX + (overlapMax - minX) * scale;
            const labelX = (sx1 + sx2) / 2;

            if (
              drawnLabels.some(
                (l) => Math.abs(l.x - labelX) < 10 && Math.abs(l.y - sy) < 10,
              )
            )
              continue;
            drawnLabels.push({ x: labelX, y: sy });

            const wallLen = overlapMax - overlapMin;
            const bboxAW = axmax - axmin;
            const realLen =
              bboxAW > 0 ? (wallLen / bboxAW) * rooms[i].width : wallLen;

            drawHorizontalMeasurement(ctx, sx1, sx2, sy, labelX, realLen);
          }
        }
      }
    }
  }
}

function drawVerticalMeasurement(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy1: number,
  sy2: number,
  labelY: number,
  realLen: number,
) {
  ctx.save();
  ctx.strokeStyle = "rgba(113,113,122,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx, sy1 + 4);
  ctx.lineTo(sx, sy2 - 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx - 3, sy1 + 4);
  ctx.lineTo(sx + 3, sy1 + 4);
  ctx.moveTo(sx - 3, sy2 - 4);
  ctx.lineTo(sx + 3, sy2 - 4);
  ctx.stroke();

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

function drawHorizontalMeasurement(
  ctx: CanvasRenderingContext2D,
  sx1: number,
  sx2: number,
  sy: number,
  labelX: number,
  realLen: number,
) {
  ctx.save();
  ctx.strokeStyle = "rgba(113,113,122,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx1 + 4, sy);
  ctx.lineTo(sx2 - 4, sy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx1 + 4, sy - 3);
  ctx.lineTo(sx1 + 4, sy + 3);
  ctx.moveTo(sx2 - 4, sy - 3);
  ctx.lineTo(sx2 - 4, sy + 3);
  ctx.stroke();

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

// ─── Snap lines ──────────────────────────────────────────────────────

export function drawSnapLines(
  dc: DrawContext,
  snapLines: SnapLine[],
  isDragging: boolean,
) {
  if (snapLines.length === 0 || !isDragging) return;
  const {
    ctx,
    containerWidth,
    containerHeight,
    scale,
    offsetX,
    offsetY,
    minX,
    minY,
  } = dc;

  ctx.save();
  ctx.strokeStyle = "rgba(59,130,246,0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  for (const line of snapLines) {
    const screenPos =
      line.orientation === "v"
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

// ─── Split preview ───────────────────────────────────────────────────

export function drawSplitPreview(
  dc: DrawContext,
  splitPreview: SplitPreview,
  activeRect: ScreenRect,
) {
  const { ctx, containerWidth, containerHeight } = dc;

  ctx.save();
  ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  if (splitPreview.orientation === "h") {
    const clampedY = Math.max(
      activeRect.y,
      Math.min(activeRect.y + activeRect.h, splitPreview.snappedMy),
    );
    ctx.beginPath();
    ctx.moveTo(activeRect.x, clampedY);
    ctx.lineTo(activeRect.x + activeRect.w, clampedY);
    ctx.stroke();

    if (splitPreview.snapped) {
      ctx.strokeStyle = "rgba(59,130,246,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, clampedY);
      ctx.lineTo(containerWidth, clampedY);
      ctx.stroke();
    }
  } else {
    const clampedX = Math.max(
      activeRect.x,
      Math.min(activeRect.x + activeRect.w, splitPreview.snappedMx),
    );
    ctx.beginPath();
    ctx.moveTo(clampedX, activeRect.y);
    ctx.lineTo(clampedX, activeRect.y + activeRect.h);
    ctx.stroke();

    if (splitPreview.snapped) {
      ctx.strokeStyle = "rgba(59,130,246,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(clampedX, 0);
      ctx.lineTo(clampedX, containerHeight);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ─── Resize handles ──────────────────────────────────────────────────

export function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  activeRect: ScreenRect,
) {
  const H_SIZE = 10;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  const drawHandle = (hx: number, hy: number) => {
    ctx.fillRect(hx - H_SIZE / 2, hy - H_SIZE / 2, H_SIZE, H_SIZE);
    ctx.strokeRect(hx - H_SIZE / 2, hy - H_SIZE / 2, H_SIZE, H_SIZE);
  };
  drawHandle(activeRect.x + activeRect.w / 2, activeRect.y);
  drawHandle(activeRect.x + activeRect.w, activeRect.y + activeRect.h / 2);
  drawHandle(activeRect.x + activeRect.w / 2, activeRect.y + activeRect.h);
  drawHandle(activeRect.x, activeRect.y + activeRect.h / 2);
}
