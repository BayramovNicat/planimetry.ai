"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useProjectsContext } from "../../../components/ClientLayout";
import { FloorPlanEditor, useFloorPlanEditor } from "../../../components/FloorPlanEditor";
import type { Project } from "../../../types";

export default function ComparePage() {
  const pathname = usePathname();
  const segments = pathname.split("/");
  const id1 = segments[2] ?? "";
  const id2 = segments[3] ?? "";
  const router = useRouter();
  const { projects, updateProject } = useProjectsContext();

  const project1 = projects.find((p) => p.id === id1) ?? null;
  const project2 = projects.find((p) => p.id === id2) ?? null;

  const onUpdateLeft = useCallback(
    (data: Partial<Pick<Project, "imageId" | "result">>) => {
      if (id1) updateProject(id1, data);
    },
    [id1, updateProject],
  );

  const onUpdateRight = useCallback(
    (data: Partial<Pick<Project, "imageId" | "result">>) => {
      if (id2) updateProject(id2, data);
    },
    [id2, updateProject],
  );

  const left = useFloorPlanEditor(project1, onUpdateLeft);
  const right = useFloorPlanEditor(project2, onUpdateRight);

  const [focusedSide, setFocusedSide] = useState<"left" | "right">("left");

  // Keyboard: undo/redo applies to focused side
  useEffect(() => {
    const focused = focusedSide === "left" ? left : right;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        left.setActiveRoom(null);
        right.setActiveRoom(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        focused.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        focused.redo();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedSide, left, right]);

  // Redirect if either project not found
  useEffect(() => {
    if (id1 && id2 && projects.length > 0 && (!project1 || !project2)) {
      router.replace("/");
    }
  }, [id1, id2, projects, project1, project2, router]);

  if (!project1 || !project2) {
    return null;
  }

  const sides = [
    { side: "left" as const, project: project1, editor: left },
    { side: "right" as const, project: project2, editor: right },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl pt-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sides.map(({ side, project, editor }) => (
            <div
              key={side}
              className={`rounded-xl border p-4 transition-colors ${
                focusedSide === side
                  ? "border-blue-300 dark:border-blue-700"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
              onPointerDown={() => setFocusedSide(side)}
            >
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {project.name}
              </h2>

              {editor.image ? (
                <FloorPlanEditor state={editor} imgClassName="max-h-64" />
              ) : (
                <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  No image uploaded for this plan
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
