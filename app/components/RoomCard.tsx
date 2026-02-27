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
  const color = ROOM_COLORS[colorIndex % ROOM_COLORS.length];

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
      className={`rounded-lg p-3 border border-zinc-200/60 dark:border-zinc-800/60 transition-all cursor-pointer ${
        isActive
          ? "ring-1 ring-blue-500"
          : isHighlighted
            ? "ring-1"
            : isDimmed
              ? "opacity-50"
              : ""
      }`}
      style={
        isHighlighted && !isActive
          ? { outlineColor: color.border }
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color.text }}
        />
        {editingField === "name" ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-blue-500 outline-none w-full"
          />
        ) : (
          <p
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
            className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 bg-transparent border-b border-blue-500 outline-none w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">m²</span>
        </div>
      ) : (
        <p
          className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          onDoubleClick={(e) => startEdit("area", e)}
        >
          {room.area} m²
        </p>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
        {room.width}m × {room.height}m
      </p>
    </div>
  );
}
