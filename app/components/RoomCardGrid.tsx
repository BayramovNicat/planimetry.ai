"use client";

import { useCallback, useRef, useState } from "react";

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
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = "0.4";
      }
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
    }
    setDragIndex(null);
    setDropIndex(null);
    dragNodeRef.current = null;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIndex !== null && index !== dragIndex) {
        setDropIndex(index);
      }
    },
    [dragIndex],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== index && onReorderRooms) {
        onReorderRooms(dragIndex, index);
      }
      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, onReorderRooms],
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {rooms.map((room, i) => (
        <div
          key={i}
          draggable={!!onReorderRooms}
          onDragStart={(e) => handleDragStart(e, i)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={(e) => handleDrop(e, i)}
          className={`${
            dropIndex === i && dragIndex !== null && dragIndex !== i
              ? "ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-zinc-950"
              : ""
          } rounded-lg transition-shadow`}
        >
          <RoomCard
            room={room}
            colorIndex={i}
            isHighlighted={hoveredRoom === i}
            isDimmed={hoveredRoom !== null && hoveredRoom !== i}
            isActive={activeRoom === i}
            onMouseEnter={() => onHoverRoom(i)}
            onMouseLeave={() => onHoverRoom(null)}
            onSelect={() => onSelectRoom(activeRoom === i ? null : i)}
            onUpdate={(fields) => onUpdateRoom(i, fields)}
          />
        </div>
      ))}
    </div>
  );
}
