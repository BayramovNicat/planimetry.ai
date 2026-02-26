"use client";

import type { Room } from "../types";
import { RoomCard } from "./RoomCard";

interface RoomCardGridProps {
  rooms: Room[];
  hoveredRoom: number | null;
  onHoverRoom: (index: number | null) => void;
}

export function RoomCardGrid({ rooms, hoveredRoom, onHoverRoom }: RoomCardGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {rooms.map((room, i) => (
        <RoomCard
          key={i}
          room={room}
          colorIndex={i}
          isHighlighted={hoveredRoom === i}
          isDimmed={hoveredRoom !== null && hoveredRoom !== i}
          onMouseEnter={() => onHoverRoom(i)}
          onMouseLeave={() => onHoverRoom(null)}
        />
      ))}
    </div>
  );
}
