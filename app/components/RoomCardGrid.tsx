"use client";

import type { Room } from "../types";
import { RoomCard } from "./RoomCard";

interface RoomCardGridProps {
  rooms: Room[];
  hoveredRoom: number | null;
  onHoverRoom: (index: number | null) => void;
  activeRoom: number | null;
  onSelectRoom: (index: number | null) => void;
  onUpdateRoom: (index: number, fields: { name?: string; area?: number }) => void;
}

export function RoomCardGrid({ rooms, hoveredRoom, onHoverRoom, activeRoom, onSelectRoom, onUpdateRoom }: RoomCardGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {rooms.map((room, i) => (
        <RoomCard
          key={i}
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
      ))}
    </div>
  );
}
