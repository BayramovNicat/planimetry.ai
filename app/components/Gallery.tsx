"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useGallery } from "../hooks/useGallery";
import { fileToBase64 } from "../utils/fileToBase64";
import { GalleryLightbox } from "./GalleryLightbox";

interface GalleryProps {
  projectId: string;
  onFocus: () => void;
}

export function Gallery({ projectId, onFocus }: GalleryProps) {
  const { images, addImage, deleteImage } = useGallery(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const base64 = await fileToBase64(file);
        addImage(base64);
      }
    },
    [addImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  return (
    <div
      tabIndex={0}
      onFocus={onFocus}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="outline-none"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Gallery</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          <Plus size={14} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-800">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Drop images here, paste, or click + to upload
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="group relative cursor-pointer overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
              onClick={() => setLightboxIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.base64}
                alt={`Gallery image ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteImage(img.id);
                }}
                className="absolute top-1.5 right-1.5 cursor-pointer rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}

/** Convert a clipboard paste event's image to base64 and add to gallery */
export async function handleGalleryPaste(
  e: ClipboardEvent,
  addImage: (base64: string) => void,
): Promise<boolean> {
  const items = e.clipboardData?.items;
  if (!items) return false;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        const base64 = await fileToBase64(file);
        addImage(base64);
        return true;
      }
    }
  }
  return false;
}
