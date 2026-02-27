"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Room } from "../types";
import { ROOM_COLORS } from "../constants";

interface RoomCardProps {
  room: Room;
  colorIndex: number;
  isHighlighted: boolean;
  isDimmed: boolean;
  isActive: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSelect: () => void;
  onUpdate: (fields: { name?: string; area?: number }) => void;
}

export function RoomCard({
  room,
  colorIndex,
  isHighlighted,
  isDimmed,
  isActive,
  onMouseEnter,
  onMouseLeave,
  onSelect,
  onUpdate,
}: RoomCardProps) {
  const [editingField, setEditingField] = useState<"name" | "area" | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const startEdit = useCallback(
    (field: "name" | "area", e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingField(field);
      setEditValue(field === "name" ? room.name : String(room.area));
    },
    [room.name, room.area],
  );

  const commitEdit = useCallback(() => {
    if (!editingField) return;
    const trimmed = editValue.trim();
    if (editingField === "name" && trimmed && trimmed !== room.name) {
      onUpdate({ name: trimmed });
    } else if (editingField === "area") {
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num > 0 && num !== room.area) {
        onUpdate({ area: num });
      }
    }
    setEditingField(null);
  }, [editingField, editValue, room.name, room.area, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitEdit();
      if (e.key === "Escape") setEditingField(null);
    },
    [commitEdit],
  );

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onSelect}
      className={`rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 transition-all cursor-pointer ${
        isActive
          ? "ring-2 ring-blue-500 shadow-lg scale-[1.02]"
          : isHighlighted
            ? "ring-2 shadow-lg scale-[1.02]"
            : isDimmed
              ? "opacity-40"
              : ""
      }`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: ROOM_COLORS[colorIndex % ROOM_COLORS.length].border,
        ...(isHighlighted && !isActive
          ? { ringColor: ROOM_COLORS[colorIndex % ROOM_COLORS.length].border }
          : {}),
      }}
    >
      {editingField === "name" ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1 bg-transparent border-b border-blue-500 outline-none w-full"
        />
      ) : (
        <p
          className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          onDoubleClick={(e) => startEdit("name", e)}
        >
          {room.name}
        </p>
      )}

      {editingField === "area" ? (
        <div className="flex items-baseline gap-1">
          <input
            ref={inputRef}
            type="number"
            step="0.1"
            min="0.1"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="text-2xl font-bold text-zinc-800 dark:text-zinc-200 bg-transparent border-b border-blue-500 outline-none w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">m²</span>
        </div>
      ) : (
        <p
          className="text-2xl font-bold text-zinc-800 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          onDoubleClick={(e) => startEdit("area", e)}
        >
          {room.area} m²
        </p>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
        {room.width}m × {room.height}m
      </p>
    </div>
  );
}
