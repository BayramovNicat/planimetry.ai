"use client";

import { useCallback, useEffect, useRef,useState } from "react";

import type { AnalysisResult,Project } from "../types";

const STORAGE_KEY = "planimetry-projects";
const OLD_SESSION_KEY = "planimetry-session";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

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

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    let loaded = loadProjects();

    if (loaded.length === 0) {
      const migrated = migrateOldSession();
      if (migrated) {
        loaded = [migrated];
        saveProjects(loaded);
      }
    }

    setProjects(loaded);
  }, []);

  const persist = useCallback((next: Project[]) => {
    setProjects(next);
    saveProjects(next);
  }, []);

  // Create a project only when there's an image to save
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
      persist([project, ...projects]);
      return id;
    },
    [projects, persist],
  );

  const deleteProject = useCallback(
    (id: string): string | null => {
      const idx = projects.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      const next = projects.filter((p) => p.id !== id);
      persist(next);
      if (next.length === 0) return null;
      const nextIdx = Math.min(idx, next.length - 1);
      return next[nextIdx].id;
    },
    [projects, persist],
  );

  const updateProject = useCallback(
    (id: string, partial: Partial<Pick<Project, "image" | "result" | "name">>) => {
      const next = projects.map((p) => (p.id === id ? { ...p, ...partial } : p));
      persist(next);
    },
    [projects, persist],
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
