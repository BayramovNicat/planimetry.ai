"use client";

import { useCallback, useMemo } from "react";

import type { GalleryImage, Project } from "../types";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Gallery hook that reads/writes from the Project's `gallery` field.
 * All data lives in the single `planimetry-projects` localStorage key.
 */
export function useGallery(
  project: Project | null,
  updateProject: (id: string, partial: { gallery?: GalleryImage[] }) => void,
) {
  const images = useMemo(() => project?.gallery ?? [], [project?.gallery]);

  const addImage = useCallback(
    (base64: string) => {
      if (!project) return;
      const img: GalleryImage = {
        id: generateId(),
        base64,
        createdAt: Date.now(),
      };
      updateProject(project.id, { gallery: [img, ...images] });
    },
    [project, images, updateProject],
  );

  const deleteImage = useCallback(
    (id: string) => {
      if (!project) return;
      updateProject(project.id, {
        gallery: images.filter((i) => i.id !== id),
      });
    },
    [project, images, updateProject],
  );

  return { images, addImage, deleteImage };
}
