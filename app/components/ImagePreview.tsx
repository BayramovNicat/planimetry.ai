"use client";

import type { ReactNode } from "react";

interface ImagePreviewProps {
  src: string;
  onClose: () => void;
  overlay?: ReactNode;
}

export function ImagePreview({ src, onClose, overlay }: ImagePreviewProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors cursor-pointer"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Floor plan"
        className="w-full max-h-125 object-contain"
      />
      {overlay && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          {overlay}
        </div>
      )}
    </div>
  );
}
