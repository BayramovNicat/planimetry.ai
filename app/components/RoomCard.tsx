"use client";

import type { Room } from "../types";
import { ROOM_COLORS } from "../constants";

interface RoomCardProps {
  room: Room;
  colorIndex: number;
  isHighlighted: boolean;
  isDimmed: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function RoomCard({
  room,
  colorIndex,
  isHighlighted,
  isDimmed,
  onMouseEnter,
  onMouseLeave,
}: RoomCardProps) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 transition-all cursor-pointer ${
        isHighlighted
          ? "ring-2 shadow-lg scale-[1.02]"
          : isDimmed
            ? "opacity-40"
            : ""
      }`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: ROOM_COLORS[colorIndex % ROOM_COLORS.length].border,
        ...(isHighlighted
          ? { ringColor: ROOM_COLORS[colorIndex % ROOM_COLORS.length].border }
          : {}),
      }}
    >
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        {room.name}
      </p>
      <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
        {room.area} m²
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
        {room.width}m × {room.height}m
      </p>
    </div>
  );
}
