"use client";

import { Upload } from "lucide-react";
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
      className="cursor-pointer rounded-xl border border-zinc-200 px-8 py-16 text-center transition-colors hover:border-zinc-300 hover:bg-zinc-100/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
    >
      <Upload size={32} className="mx-auto mb-4 text-zinc-400" />
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Upload a floor plan to analyze
      </p>
      <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        Drag and drop, browse, or Ctrl+V to paste
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
