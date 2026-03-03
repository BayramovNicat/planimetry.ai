"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ROOM_COLORS } from "../constants";
import type { Room } from "../types";

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
  const color = ROOM_COLORS[(room.colorIndex ?? colorIndex) % ROOM_COLORS.length];

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
      className={`cursor-pointer rounded-lg border border-zinc-200/60 p-3 transition-all dark:border-zinc-800/60 ${
        isActive ? "ring-1 ring-blue-500" : isHighlighted ? "ring-1" : isDimmed ? "opacity-50" : ""
      }`}
      style={isHighlighted && !isActive ? { outlineColor: color.border } : undefined}
    >
      <div className="mb-1 flex items-center gap-2">
        <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color.text }} />
        {editingField === "name" ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full border-b border-blue-500 bg-transparent text-sm font-medium text-zinc-900 outline-none dark:text-zinc-100"
          />
        ) : (
          <p
            className="text-sm font-medium text-zinc-900 transition-colors hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
            onDoubleClick={(e) => startEdit("name", e)}
          >
            {room.name}
          </p>
        )}
      </div>

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
            className="w-20 [appearance:textfield] border-b border-blue-500 bg-transparent text-lg font-semibold text-zinc-800 outline-none dark:text-zinc-200 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">m²</span>
        </div>
      ) : (
        <p
          className="text-lg font-semibold text-zinc-800 transition-colors hover:text-blue-600 dark:text-zinc-200 dark:hover:text-blue-400"
          onDoubleClick={(e) => startEdit("area", e)}
        >
          {room.area} m²
        </p>
      )}

      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        {room.width}m × {room.height}m
      </p>
    </div>
  );
}
