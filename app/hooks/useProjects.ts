"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { Project } from "../types";
import { deleteImages, getImage, saveImage } from "../utils/imageStore";

const STORAGE_KEY = "planimetry-projects";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ── localStorage helpers ─────────────────────────────────────── */

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    if (e instanceof Error && e.name === "QuotaExceededError") {
      console.error("[Planimetry] LocalStorage quota exceeded. Some data may not be saved.");
    } else {
      console.error("[Planimetry] Failed to save to LocalStorage:", e);
    }
  }
}

/* ── External store for useSyncExternalStore ───────────────────── */

let listeners: Array<() => void> = [];
let cachedProjects: Project[] | null = null;

function emitChange() {
  cachedProjects = null; // bust cache so getSnapshot re-reads
  for (const l of listeners) l();
}

function subscribe(callback: () => void): () => void {
  listeners = [...listeners, callback];
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getSnapshot(): Project[] {
  if (cachedProjects !== null) return cachedProjects;

  const projects = loadProjects();

  cachedProjects = projects;
  return cachedProjects;
}

const SERVER_SNAPSHOT: Project[] = [];
function getServerSnapshot(): Project[] {
  return SERVER_SNAPSHOT;
}

/* ── Mutators (write to localStorage + notify subscribers) ───── */

function persistAndEmit(next: Project[]) {
  saveProjects(next);
  emitChange();
}

/* ── Hook ──────────────────────────────────────────────────────── */

export function useProjects() {
  const projects = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addProject = useCallback(
    async (imageBase64: string): Promise<string> => {
      const id = generateId();
      const imageId = `fp_${id}`;
      await saveImage(imageId, imageBase64);

      const project: Project = {
        id,
        name: `Plan ${projects.length + 1}`,
        imageId,
        result: null,
        createdAt: Date.now(),
      };
      persistAndEmit([project, ...projects]);
      return id;
    },
    [projects],
  );

  const deleteProject = useCallback(
    async (id: string): Promise<string | null> => {
      const idx = projects.findIndex((p) => p.id === id);
      if (idx === -1) return null;

      const project = projects[idx];
      // Clean up IDB images
      const imageIds: string[] = [];
      if (project.imageId) imageIds.push(project.imageId);
      if (project.gallery) {
        for (const img of project.gallery) imageIds.push(img.id);
      }
      deleteImages(imageIds).catch((e) =>
        console.error("[Planimetry] Failed to delete images from IDB:", e),
      );

      const next = projects.filter((p) => p.id !== id);
      persistAndEmit(next);
      if (next.length === 0) return null;
      const nextIdx = Math.min(idx, next.length - 1);
      return next[nextIdx].id;
    },
    [projects],
  );

  const updateProject = useCallback(
    (id: string, partial: Partial<Pick<Project, "imageId" | "result" | "name" | "gallery">>) => {
      const next = projects.map((p) => (p.id === id ? { ...p, ...partial } : p));
      persistAndEmit(next);
    },
    [projects],
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      updateProject(id, { name });
    },
    [updateProject],
  );

  return {
    projects,
    addProject,
    deleteProject,
    updateProject,
    renameProject,
  };
}

/* ── Image loading helper ─────────────────────────────────────── */

export async function loadProjectImage(project: Project): Promise<string | null> {
  if (project.imageId) return getImage(project.imageId);
  return null;
}

export async function loadGalleryImage(imageId: string): Promise<string | null> {
  return getImage(imageId);
}
