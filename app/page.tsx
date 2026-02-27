"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { useProjectsContext } from "./components/ClientLayout";
import { ImageDropZone } from "./components/ImageDropZone";
import { fileToBase64 } from "./utils/fileToBase64";

export default function Home() {
  const router = useRouter();
  const { addProject } = useProjectsContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const base64 = await fileToBase64(file);
      const id = addProject(base64);
      router.push(`/project/${id}`);
    },
    [addProject, router],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 md:p-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl pt-12">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Analyze Floor Plan
        </h1>
        <p className="mb-8 text-zinc-500 dark:text-zinc-400">Upload an image to get started</p>

        <ImageDropZone onFile={handleFile} onDrop={handleDrop} fileInputRef={fileInputRef} />
      </div>
    </div>
  );
}
