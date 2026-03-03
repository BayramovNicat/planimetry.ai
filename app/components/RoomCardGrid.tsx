"use client";

import { memo, useCallback, useRef, useState } from "react";

import { ROOM_COLORS } from "../constants";
import type { Room } from "../types";
import { RoomCard } from "./RoomCard";

interface RoomCardGridProps {
  rooms: Room[];
  hoveredRoom: number | null;
  onHoverRoom: (index: number | null) => void;
  activeRoom: number | null;
  onSelectRoom: (index: number | null) => void;
  onUpdateRoom: (index: number, fields: { name?: string; area?: number }) => void;
  onReorderRooms?: (fromIndex: number, toIndex: number) => void;
}

const DATA_ATTR = "data-room-index";

function getIndex(e: React.MouseEvent | React.DragEvent): number | null {
  const el = (e.target as HTMLElement).closest(`[${DATA_ATTR}]`);
  if (!el) return null;
  return Number(el.getAttribute(DATA_ATTR));
}

const DraggableCard = memo(function DraggableCard({
  room,
  index,
  isHighlighted,
  isDimmed,
  isActive,
  isDragging,
  isDropTarget,
  draggable,
  onUpdate,
}: {
  room: Room;
  index: number;
  isHighlighted: boolean;
  isDimmed: boolean;
  isActive: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  draggable: boolean;
  onUpdate: (index: number, fields: { name?: string; area?: number }) => void;
}) {
  const handleUpdate = useCallback(
    (fields: { name?: string; area?: number }) => onUpdate(index, fields),
    [index, onUpdate],
  );

  return (
    <div
      {...{ [DATA_ATTR]: index }}
      draggable={draggable}
      className={`rounded-lg border-2 transition-all ${
        isDropTarget ? "border-blue-400 dark:border-blue-500" : "border-transparent"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <RoomCard
        room={room}
        color={ROOM_COLORS[(room.colorIndex ?? index) % ROOM_COLORS.length]}
        isHighlighted={isHighlighted}
        isDimmed={isDimmed}
        isActive={isActive}
        onUpdate={handleUpdate}
      />
    </div>
  );
});

export function RoomCardGrid({
  rooms,
  hoveredRoom,
  onHoverRoom,
  activeRoom,
  onSelectRoom,
  onUpdateRoom,
  onReorderRooms,
}: RoomCardGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const draggable = !!onReorderRooms;

  // --- Delegated mouse handlers on grid ---
  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      const i = getIndex(e);
      if (i !== null && i !== hoveredRoom) onHoverRoom(i);
    },
    [hoveredRoom, onHoverRoom],
  );

  const handleMouseLeave = useCallback(() => onHoverRoom(null), [onHoverRoom]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const i = getIndex(e);
      if (i !== null) onSelectRoom(activeRoom === i ? null : i);
    },
    [activeRoom, onSelectRoom],
  );

  // --- Delegated drag handlers on grid ---
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const i = getIndex(e);
    if (i === null) return;
    setDragIndex(i);
    e.dataTransfer.effectAllowed = "move";

    const el = (e.target as HTMLElement).closest(`[${DATA_ATTR}]`) as HTMLElement;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px;padding:${pad}px`;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.width = `${rect.width}px`;
    clone.style.opacity = "1";
    const isDark =
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    clone.style.backgroundColor = isDark ? "#18181b" : "#ffffff";
    clone.style.borderRadius = "0.5rem";
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    ghostRef.current = wrapper;
    e.dataTransfer.setDragImage(wrapper, rect.width / 2 + pad, rect.height / 2 + pad);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const i = getIndex(e);
      if (i !== null && dragIndex !== null && i !== dragIndex) {
        setDropIndex(i);
      }
    },
    [dragIndex],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the grid entirely
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDropIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const i = getIndex(e);
      if (i !== null && dragIndex !== null && dragIndex !== i && onReorderRooms) {
        onReorderRooms(dragIndex, i);
      }
      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, onReorderRooms],
  );

  const handleDragEnd = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-3"
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      {rooms.map((room, i) => (
        <DraggableCard
          key={room.colorIndex ?? i}
          room={room}
          index={i}
          isHighlighted={hoveredRoom === i}
          isDimmed={hoveredRoom !== null && hoveredRoom !== i}
          isActive={activeRoom === i}
          isDragging={dragIndex === i}
          isDropTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
          draggable={draggable}
          onUpdate={onUpdateRoom}
        />
      ))}
    </div>
  );
}
