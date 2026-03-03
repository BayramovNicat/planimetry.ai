"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useProjectsContext } from "../../components/ClientLayout";
import { FloorPlanEditor, useFloorPlanEditor } from "../../components/FloorPlanEditor";
import { Gallery, handleGalleryPaste } from "../../components/Gallery";
import { ImageDropZone } from "../../components/ImageDropZone";
import { useGallery } from "../../hooks/useGallery";

type PasteTarget = "floorplan" | "gallery";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { projects, updateProject } = useProjectsContext();

  const project = projects.find((p) => p.id === params.id) ?? null;

  const onUpdate = useCallback(
    (data: Parameters<typeof updateProject>[1]) => {
      if (params.id) updateProject(params.id, data);
    },
    [params.id, updateProject],
  );

  const editor = useFloorPlanEditor(project, onUpdate, { disablePaste: true });
  const { addImage } = useGallery(params.id);

  const [pasteTarget, setPasteTarget] = useState<PasteTarget>("floorplan");

  // Paste routing: floor plan or gallery based on focus
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (pasteTarget === "gallery") {
        handleGalleryPaste(e, addImage);
      } else {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) editor.handleFile(file);
            break;
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addImage, editor, pasteTarget]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") editor.setActiveRoom(null);
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        editor.redo();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  useEffect(() => {
    if (editor.result && editor.canvasRef.current) {
      editor.canvasRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [editor.result, editor.canvasRef]);

  // Redirect if project not found after hydration
  useEffect(() => {
    if (projects.length > 0 && !project) {
      router.replace("/");
    }
  }, [projects, project, router]);

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl pt-12">
        <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {project.name}
        </h1>

        {!editor.image && (
          <div tabIndex={0} onFocus={() => setPasteTarget("floorplan")} className="outline-none">
            <ImageDropZone
              onFile={editor.handleFile}
              onDrop={editor.handleDrop}
              fileInputRef={editor.fileInputRef}
            />
          </div>
        )}

        {editor.image && (
          <div tabIndex={0} onFocus={() => setPasteTarget("floorplan")} className="outline-none">
            <FloorPlanEditor state={editor} />
          </div>
        )}

        <div className="mt-6">
          <Gallery projectId={params.id} onFocus={() => setPasteTarget("gallery")} />
        </div>
      </div>
    </div>
  );
}
