"use client";

import type { RefObject } from "react";

interface ImageDropZoneProps {
  onFile: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export function ImageDropZone({ onFile, onDrop, fileInputRef }: ImageDropZoneProps) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-16 text-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors bg-white dark:bg-zinc-900"
    >
      <div className="text-5xl mb-4">📐</div>
      <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
        Drop a floor plan image here
      </p>
      <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2">
        or click to browse — you can also paste with Ctrl+V
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
