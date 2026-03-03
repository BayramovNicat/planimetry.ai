"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";

interface ImagePreviewProps {
  src: string;
  overlay?: ReactNode;
  activeRoom: number | null;
  onDrawRect: (pxW: number, pxH: number) => void;
  /** Extra class for the <img>, e.g. "max-h-64" to constrain in compare view */
  imgClassName?: string;
}

export function ImagePreview({
  src,
  overlay,
  activeRoom,
  onDrawRect,
  imgClassName,
}: ImagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [prevActiveRoom, setPrevActiveRoom] = useState(activeRoom);

  if (prevActiveRoom !== activeRoom) {
    setPrevActiveRoom(activeRoom);
    setDrawing(false);
    setStart(null);
    setCurrent(null);
  }

  const getPos = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeRoom === null) return;
      e.preventDefault();
      const pos = getPos(e);
      setStart(pos);
      setCurrent(pos);
      setDrawing(true);
    },
    [activeRoom, getPos],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return;
      setCurrent(getPos(e));
    },
    [drawing, getPos],
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing || !start || !current) return;
    const pxW = Math.abs(current.x - start.x);
    const pxH = Math.abs(current.y - start.y);
    setDrawing(false);
    setStart(null);
    setCurrent(null);
    if (pxW > 10 && pxH > 10) {
      onDrawRect(pxW, pxH);
    }
  }, [drawing, start, current, onDrawRect]);

  const rectStyle =
    drawing && start && current
      ? {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        }
      : null;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl border border-zinc-200/60 dark:border-zinc-800/60"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Floor plan"
        className={`w-full object-contain ${imgClassName ?? "max-h-125"}`}
        draggable={false}
      />
      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          {overlay}
        </div>
      )}
      {activeRoom !== null && !overlay && (
        <div
          className="absolute inset-0 cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-zinc-900/80 px-2.5 py-1 text-[11px] text-white">
            Draw a rectangle over this room
          </div>
          {rectStyle && (
            <div className="absolute border-2 border-blue-500/70 bg-blue-500/5" style={rectStyle} />
          )}
        </div>
      )}
    </div>
  );
}
