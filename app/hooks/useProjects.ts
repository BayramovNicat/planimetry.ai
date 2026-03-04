"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { AnalysisResult, Project } from "../types";

const STORAGE_KEY = "planimetry-projects";
const OLD_SESSION_KEY = "planimetry-session";

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
  } catch {
    // quota exceeded
  }
}

function migrateOldSession(): Project | null {
  try {
    const raw = localStorage.getItem(OLD_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as { image: string; result: AnalysisResult };
    if (!session.image) return null;
    const project: Project = {
      id: generateId(),
      name: "Imported Plan",
      image: session.image,
      result: session.result ?? null,
      createdAt: Date.now(),
    };
    localStorage.removeItem(OLD_SESSION_KEY);
    return project;
  } catch {
    return null;
  }
}

/** Migrate base64 panorama strings in rooms to gallery images + IDs */
function migratePanoramaImages(projects: Project[]): boolean {
  let changed = false;
  for (const project of projects) {
    if (!project.result || !project.result.rooms) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const room of project.result.rooms as any[]) {
      if (room.panoramaImage) {
        // Room has old base64 string
        const base64 = room.panoramaImage;
        let imgId = project.gallery?.find((img) => img.base64 === base64)?.id;

        // If not in gallery, add it
        if (!imgId) {
          imgId = generateId();
          project.gallery = [
            { id: imgId, base64, createdAt: Date.now() },
            ...(project.gallery ?? []),
          ];
        }

        // Update room to use ID instead of base64 string
        room.panoramaImageId = imgId;
        delete room.panoramaImage;
        changed = true;
      }
    }
  }
  return changed;
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

  let projects = loadProjects();

  // One-time migration of old session format
  if (projects.length === 0) {
    const migrated = migrateOldSession();
    if (migrated) {
      projects = [migrated];
      saveProjects(projects);
    }
  }

  // One-time migration of separate gallery keys into project objects
  // NOTE: migrateGalleryKeys is not defined in the provided code, assuming it's a placeholder or external.
  // For now, it's commented out to avoid a reference error.
  // const galleryMigrated = migrateGalleryKeys(projects);
  // One-time migration of full base64 strings in rooms to gallery IDs
  const panoImagesMigrated = migratePanoramaImages(projects);

  if (/* galleryMigrated || */ panoImagesMigrated) {
    saveProjects(projects);
  }

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
    (image: string): string => {
      const id = generateId();
      const project: Project = {
        id,
        name: `Plan ${projects.length + 1}`,
        image,
        result: null,
        createdAt: Date.now(),
      };
      persistAndEmit([project, ...projects]);
      return id;
    },
    [projects],
  );

  const deleteProject = useCallback(
    (id: string): string | null => {
      const idx = projects.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      const next = projects.filter((p) => p.id !== id);
      persistAndEmit(next);
      if (next.length === 0) return null;
      const nextIdx = Math.min(idx, next.length - 1);
      return next[nextIdx].id;
    },
    [projects],
  );

  const updateProject = useCallback(
    (id: string, partial: Partial<Pick<Project, "image" | "result" | "name" | "gallery">>) => {
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
