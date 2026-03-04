import { useCallback } from "react";

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
import { hitTest } from "./snapUtils";
import { useCanvasConnect } from "./useCanvasConnect";
import { useCanvasDrag } from "./useCanvasDrag";
import { useCanvasSplit } from "./useCanvasSplit";

const H_HIT_SIZE = 12; // handle hit-test area

interface HandleDef {
  side: "top" | "bottom" | "left" | "right";
  x: number;
  y: number;
}

function getHandles(rect: { x: number; y: number; w: number; h: number }): HandleDef[] {
  return [
    { side: "top", x: rect.x + rect.w / 2, y: rect.y },
    { side: "right", x: rect.x + rect.w, y: rect.y + rect.h / 2 },
    { side: "bottom", x: rect.x + rect.w / 2, y: rect.y + rect.h },
    { side: "left", x: rect.x, y: rect.y + rect.h / 2 },
  ];
}

interface UseCanvasInteractionArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  normalizedRooms: Room[];
  layoutRef: React.RefObject<LayoutInfo>;
  highlightIndex: number | null;
  activeRoom: number | null;
  splitMode?: boolean;
  connectMode?: boolean;
  connections?: Connection[];
  onHoverRoom: (index: number | null) => void;
  onSelectRoom: (index: number | null) => void;
  onMoveRoom: (index: number, bbox: Bbox) => void;
  onUpdateRoom?: (index: number, data: Partial<Room>) => void;
  onSplit?: (index: number, orientation: "h" | "v", ratio: number) => void;
  onMergeRooms?: (indexA: number, indexB: number) => void;
  onConnect?: (from: number, to: number) => void;
  drawRooms: (
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
  ) => void;
}

/**
 * Translates raw DOM mouse events into drag/split/select/hover actions.
 * Single Responsibility: event → action mapping and cursor management.
 */
export function useCanvasInteraction({
  canvasRef,
  normalizedRooms,
  layoutRef,
  highlightIndex,
  activeRoom,
  splitMode,
  connectMode,
  connections,
  onHoverRoom,
  onSelectRoom,
  onMoveRoom,
  onUpdateRoom,
  onSplit,
  onMergeRooms,
  onConnect,
  drawRooms,
}: UseCanvasInteractionArgs) {
  const drag = useCanvasDrag(normalizedRooms);
  const split = useCanvasSplit(normalizedRooms);
  const connect = useCanvasConnect(normalizedRooms);

  const getMousePos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { mx: 0, my: 0 };
      const rect = canvas.getBoundingClientRect();
      return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
    },
    [canvasRef],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { mx, my } = getMousePos(e);

      // Connect mode: click on circle to start connection drag
      if (connectMode && onConnect) {
        const { rects } = layoutRef.current;
        const hit = connect.hitTestCircle(mx, my, rects);
        if (hit !== null) {
          e.preventDefault();
          connect.startConnect(hit, rects);
        }
        return;
      }

      // Split mode: click to split the active room
      if (splitMode && activeRoom !== null && onSplit) {
        const { rects } = layoutRef.current;
        const activeRect = rects[activeRoom];
        if (
          activeRect &&
          mx >= activeRect.x &&
          mx <= activeRect.x + activeRect.w &&
          my >= activeRect.y &&
          my <= activeRect.y + activeRect.h
        ) {
          e.preventDefault();
          split.executeSplit(activeRoom, activeRect, onSplit);
          return;
        }
      }

      const { rects } = layoutRef.current;

      // Hit test resize handles
      if (
        activeRoom !== null &&
        activeRoom < normalizedRooms.length &&
        !normalizedRooms[activeRoom].subRects
      ) {
        const activeRect = rects[activeRoom];
        if (activeRect) {
          const handles = getHandles(activeRect);
          for (const h of handles) {
            if (Math.abs(mx - h.x) <= H_HIT_SIZE && Math.abs(my - h.y) <= H_HIT_SIZE) {
              e.preventDefault();
              drag.startResizeDrag(activeRoom, h.side, mx, my);
              return;
            }
          }
        }
      }

      // Hit test rooms for move drag
      const found = hitTest(mx, my, rects);
      if (found !== null) {
        e.preventDefault();
        drag.startMoveDrag(found, mx, my);
      }
    },
    [
      getMousePos,
      normalizedRooms,
      activeRoom,
      splitMode,
      connectMode,
      onSplit,
      onConnect,
      layoutRef,
      drag,
      split,
      connect,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { mx, my } = getMousePos(e);

      // Connect mode
      if (connectMode) {
        const { rects } = layoutRef.current;

        // Dragging a connection line
        if (connect.dragRef.current) {
          const preview = connect.updateConnect(mx, my, rects);
          canvas.style.cursor = "grabbing";
          drawRooms(highlightIndex, null, undefined, {
            connectMode: true,
            connections,
            connectPreview: preview,
            connectHoverIndex: preview?.targetIndex ?? null,
          });
          return;
        }

        // Hovering — check if over a circle
        const hoverCircle = connect.hitTestCircle(mx, my, rects);
        canvas.style.cursor = hoverCircle !== null ? "grab" : "default";
        drawRooms(highlightIndex, null, undefined, {
          connectMode: true,
          connections,
          connectHoverIndex: hoverCircle,
        });
        return;
      }

      // Split mode: show preview line on hover
      if (splitMode && activeRoom !== null) {
        const { rects } = layoutRef.current;
        const activeRect = rects[activeRoom];
        if (activeRect) {
          const preview = split.updateSplitPreview(
            mx,
            my,
            activeRoom,
            activeRect,
            layoutRef.current,
            normalizedRooms[activeRoom],
          );
          if (preview) {
            canvas.style.cursor = "crosshair";
            drawRooms(highlightIndex, activeRoom, undefined, {
              splitPreview: preview,
            });
            return;
          } else {
            if (split.splitPreviewRef.current) {
              split.clearSplitPreview();
              drawRooms(highlightIndex, activeRoom);
            }
          }
        }
      }

      const currentDrag = drag.dragRef.current;

      // Set cursor during drag
      if (currentDrag && currentDrag.type === "resize" && currentDrag.side) {
        canvas.style.cursor =
          currentDrag.side === "left" || currentDrag.side === "right" ? "ew-resize" : "ns-resize";
      } else if (currentDrag && currentDrag.type === "move") {
        canvas.style.cursor = "grabbing";
      }

      // Process active drag
      if (currentDrag) {
        const result = drag.updateDrag(mx, my, layoutRef.current.scale, activeRoom);
        if (result) {
          drawRooms(result.highlight, result.activeRoom, result.overrideBox, {
            dragIndex: currentDrag.index,
            dragMoved: currentDrag.moved,
            snapLines: drag.snapLinesRef.current,
          });
        }
        return;
      }

      // Normal hover
      const { rects } = layoutRef.current;
      const foundRoom = hitTest(mx, my, rects);
      onHoverRoom(foundRoom);

      // Handle hover cursor (skip for composite rooms — no resize handles)
      let overHandle = false;
      if (activeRoom !== null && rects[activeRoom] && !normalizedRooms[activeRoom]?.subRects) {
        const activeRect = rects[activeRoom];
        const handles = getHandles(activeRect);
        for (const h of handles) {
          if (Math.abs(mx - h.x) <= H_HIT_SIZE && Math.abs(my - h.y) <= H_HIT_SIZE) {
            overHandle = true;
            canvas.style.cursor =
              h.side === "left" || h.side === "right" ? "ew-resize" : "ns-resize";
            break;
          }
        }
      }
      if (!overHandle) {
        canvas.style.cursor = foundRoom !== null ? "grab" : "crosshair";
      }
    },
    [
      canvasRef,
      getMousePos,
      normalizedRooms,
      drag,
      split,
      connect,
      layoutRef,
      highlightIndex,
      activeRoom,
      splitMode,
      connectMode,
      connections,
      onHoverRoom,
      drawRooms,
    ],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Connect mode: finalize connection
      if (connectMode && connect.dragRef.current && onConnect) {
        const { mx, my } = getMousePos(e);
        const { rects } = layoutRef.current;
        connect.endConnect(mx, my, rects, onConnect);
        drawRooms(highlightIndex, null, undefined, {
          connectMode: true,
          connections,
        });
        return;
      }
      if (connectMode) return;

      // Split mode clicks are handled in handleMouseDown
      if (splitMode && activeRoom !== null) return;

      const { mx, my } = getMousePos(e);
      const { rects } = layoutRef.current;
      const found = hitTest(mx, my, rects);
      const currentDrag = drag.dragRef.current;

      // Commit a real drag (moved beyond threshold)
      if (currentDrag?.moved && drag.dragBboxRef.current) {
        drag.endDrag(onMoveRoom, onUpdateRoom);
      } else {
        // Click (no drag or drag didn't move) — handle merge or select
        drag.cancelDrag();

        if (
          e.shiftKey &&
          activeRoom !== null &&
          found !== null &&
          found !== activeRoom &&
          onMergeRooms
        ) {
          onMergeRooms(activeRoom, found);
        } else if (found === null && activeRoom !== null) {
          onSelectRoom(null);
        } else if (found !== null) {
          onSelectRoom(found === activeRoom ? null : found);
        }
      }

      // Update cursor
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = found !== null ? "grab" : "crosshair";
      }

      drawRooms(highlightIndex, activeRoom);
    },
    [
      canvasRef,
      getMousePos,
      drag,
      connect,
      layoutRef,
      activeRoom,
      splitMode,
      connectMode,
      connections,
      onSelectRoom,
      onMoveRoom,
      onUpdateRoom,
      onMergeRooms,
      onConnect,
      drawRooms,
      highlightIndex,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    // Cancel any connect drag
    if (connectMode && connect.dragRef.current) {
      connect.cancelConnect();
      drawRooms(highlightIndex, null, undefined, {
        connectMode: true,
        connections,
      });
      return;
    }

    const currentDrag = drag.dragRef.current;
    if (currentDrag?.moved && drag.dragBboxRef.current) {
      drag.endDrag(onMoveRoom, onUpdateRoom);
    } else {
      drag.cancelDrag();
    }

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "crosshair";
    }

    onHoverRoom(null);
    drawRooms(highlightIndex, activeRoom);
  }, [
    canvasRef,
    drag,
    connect,
    connectMode,
    connections,
    onHoverRoom,
    onMoveRoom,
    onUpdateRoom,
    drawRooms,
    highlightIndex,
    activeRoom,
  ]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
}
