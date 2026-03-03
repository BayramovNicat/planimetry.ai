"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { GalleryImage } from "../types";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function storageKey(projectId: string): string {
  return `planimetry-gallery-${projectId}`;
}

function loadImages(projectId: string): GalleryImage[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    return JSON.parse(raw) as GalleryImage[];
  } catch {
    return [];
  }
}

function saveImages(projectId: string, images: GalleryImage[]) {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(images));
  } catch {
    // quota exceeded
  }
}

/* ── Per-project external stores ──────────────────────────────── */

const storeMap = new Map<
  string,
  {
    listeners: Array<() => void>;
    cached: GalleryImage[] | null;
    subscribe: (cb: () => void) => () => void;
    getSnapshot: () => GalleryImage[];
  }
>();

function getStore(projectId: string) {
  let store = storeMap.get(projectId);
  if (store) return store;

  store = {
    listeners: [],
    cached: null,
    subscribe(cb: () => void) {
      store!.listeners = [...store!.listeners, cb];
      return () => {
        store!.listeners = store!.listeners.filter((l) => l !== cb);
      };
    },
    getSnapshot() {
      if (store!.cached !== null) return store!.cached;
      store!.cached = loadImages(projectId);
      return store!.cached;
    },
  };

  storeMap.set(projectId, store);
  return store;
}

function emitChange(projectId: string) {
  const store = storeMap.get(projectId);
  if (!store) return;
  store.cached = null;
  for (const l of store.listeners) l();
}

const SERVER_SNAPSHOT: GalleryImage[] = [];

/* ── Hook ──────────────────────────────────────────────────────── */

export function useGallery(projectId: string) {
  const store = getStore(projectId);
  const images = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAPSHOT);

  const addImage = useCallback(
    (base64: string) => {
      const img: GalleryImage = {
        id: generateId(),
        base64,
        createdAt: Date.now(),
      };
      saveImages(projectId, [img, ...images]);
      emitChange(projectId);
    },
    [projectId, images],
  );

  const deleteImage = useCallback(
    (id: string) => {
      saveImages(
        projectId,
        images.filter((i) => i.id !== id),
      );
      emitChange(projectId);
    },
    [projectId, images],
  );

  return { images, addImage, deleteImage };
}
