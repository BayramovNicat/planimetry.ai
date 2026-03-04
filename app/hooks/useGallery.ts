"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { GalleryImage, Project } from "../types";
import { deleteImage as deleteImageFromIDB, getImage, saveImage } from "../utils/imageStore";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Gallery hook that reads/writes from the Project's `gallery` field.
 * Image binary data is stored in IndexedDB; only metadata lives in localStorage.
 */
export function useGallery(
  project: Project | null,
  updateProject: (id: string, partial: { gallery?: GalleryImage[] }) => void,
) {
  const galleryMeta = useMemo(() => project?.gallery ?? [], [project?.gallery]);
  const [loadedImages, setLoadedImages] = useState<Map<string, string>>(new Map());

  // Load base64 data from IDB for all gallery images
  useEffect(() => {
    let cancelled = false;
    const ids = galleryMeta.map((g) => g.id);

    // Only load images that aren't already loaded
    const toLoad = ids.filter((id) => !loadedImages.has(id));
    if (toLoad.length === 0) return;

    Promise.all(toLoad.map(async (id) => ({ id, base64: await getImage(id) }))).then((results) => {
      if (cancelled) return;
      setLoadedImages((prev) => {
        const next = new Map(prev);
        for (const { id, base64 } of results) {
          if (base64) next.set(id, base64);
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [galleryMeta, loadedImages]);

  // Merge loaded base64 into gallery metadata
  const images = useMemo<GalleryImage[]>(
    () =>
      galleryMeta.map((g) => ({
        ...g,
        base64: loadedImages.get(g.id) ?? g.base64,
      })),
    [galleryMeta, loadedImages],
  );

  const addImage = useCallback(
    async (base64: string) => {
      if (!project) return;
      const id = generateId();

      // Save to IDB (compressed)
      await saveImage(id, base64);

      // Update loaded cache immediately so UI shows it
      setLoadedImages((prev) => new Map(prev).set(id, base64));

      const img: GalleryImage = {
        id,
        createdAt: Date.now(),
      };
      updateProject(project.id, { gallery: [img, ...galleryMeta] });
    },
    [project, galleryMeta, updateProject],
  );

  const deleteImage = useCallback(
    (id: string) => {
      if (!project) return;

      // Remove from IDB
      deleteImageFromIDB(id).catch((e) =>
        console.error("[Planimetry] Failed to delete gallery image from IDB:", e),
      );

      // Remove from loaded cache
      setLoadedImages((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      updateProject(project.id, {
        gallery: galleryMeta.filter((i) => i.id !== id),
      });
    },
    [project, galleryMeta, updateProject],
  );

  return { images, addImage, deleteImage };
}
