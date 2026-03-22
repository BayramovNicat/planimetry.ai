"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useProjectsContext } from "../../components/ClientLayout";
import { FloorPlanEditor, useFloorPlanEditor } from "../../components/FloorPlanEditor";
import { Gallery, handleGalleryPaste } from "../../components/Gallery";
import { ImageDropZone } from "../../components/ImageDropZone";
import { useGallery } from "../../hooks/useGallery";

export default function ProjectPage() {
  const pathname = usePathname();
  const id = pathname.split("/")[2] ?? "";
  const router = useRouter();
  const { projects, updateProject } = useProjectsContext();

  const project = projects.find((p) => p.id === id) ?? null;

  const onUpdate = useCallback(
    (data: Parameters<typeof updateProject>[1]) => {
      if (id) updateProject(id, data);
    },
    [id, updateProject],
  );

  const editor = useFloorPlanEditor(project, onUpdate, { disablePaste: true });
  const { addImage } = useGallery(project, updateProject);

  // Paste routing: always add to gallery on this page
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      handleGalleryPaste(e, addImage);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addImage]);

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
    if (id && projects.length > 0 && !project) {
      router.replace("/");
    }
  }, [id, projects, project, router]);

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
          <ImageDropZone
            onFile={editor.handleFile}
            onDrop={editor.handleDrop}
            fileInputRef={editor.fileInputRef}
          />
        )}

        {editor.image && <FloorPlanEditor state={editor} />}

        <div className="mt-6">
          <Gallery project={project} updateProject={updateProject} />
        </div>
      </div>
    </div>
  );
}
