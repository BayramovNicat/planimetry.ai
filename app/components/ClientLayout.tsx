"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useSyncExternalStore } from "react";

import { useProjects } from "../hooks/useProjects";
import type { Project } from "../types";
import { Sidebar } from "./Sidebar";

interface ProjectsContextValue {
  projects: Project[];
  activeId: string | null;
  addProject: (image: string) => Promise<string>;
  updateProject: (
    id: string,
    partial: Partial<Pick<Project, "imageId" | "result" | "name" | "gallery">>,
  ) => void;
}

const ProjectsContext = createContext<ProjectsContextValue>({
  projects: [],
  activeId: null,
  addProject: async () => "",
  updateProject: () => {},
});

export function useProjectsContext() {
  return useContext(ProjectsContext);
}

const SIDEBAR_KEY = "planimetry-sidebar";

function getCollapsedSnapshot(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "open";
  } catch {
    return true;
  }
}

function getCollapsedServerSnapshot(): boolean {
  return true;
}

function subscribeCollapsed(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === SIDEBAR_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { projects, addProject, deleteProject, updateProject, renameProject } = useProjects();

  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );

  const toggleSidebar = () => {
    const next = !collapsed;
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "open");
      // Dispatch event so useSyncExternalStore picks up the change
      window.dispatchEvent(new StorageEvent("storage", { key: SIDEBAR_KEY }));
    } catch {}
  };

  // Extract active project ID from URL
  const projectMatch = pathname.match(/^\/project\/([^/]+)/);
  const compareMatch = pathname.match(/^\/compare\/([^/]+)\/([^/]+)/);
  const activeId = projectMatch?.[1] ?? compareMatch?.[1] ?? null;

  return (
    <ProjectsContext.Provider value={{ projects, activeId, addProject, updateProject }}>
      <Sidebar
        projects={projects}
        activeId={activeId}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        onDelete={deleteProject}
        onRename={renameProject}
      />
      <main
        className={`min-h-screen transition-[margin] duration-300 ease-in-out ${
          collapsed ? "ml-0" : "md:ml-65"
        }`}
      >
        {children}
      </main>
    </ProjectsContext.Provider>
  );
}
