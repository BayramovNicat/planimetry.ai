"use client";

interface ImagePreviewProps {
  src: string;
  onClose: () => void;
}

export function ImagePreview({ src, onClose }: ImagePreviewProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors cursor-pointer"
      >
        ✕
      </button>
      <img
        src={src}
        alt="Floor plan"
        className="w-full max-h-125 object-contain"
      />
    </div>
  );
}
