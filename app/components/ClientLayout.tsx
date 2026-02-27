"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useProjects } from "../hooks/useProjects";
import type { Project } from "../types";

interface ProjectsContextValue {
  projects: Project[];
  activeId: string | null;
  addProject: (image: string) => string;
  updateProject: (id: string, partial: Partial<Pick<Project, "image" | "result" | "name">>) => void;
}

const ProjectsContext = createContext<ProjectsContextValue>({
  projects: [],
  activeId: null,
  addProject: () => "",
  updateProject: () => {},
});

export function useProjectsContext() {
  return useContext(ProjectsContext);
}

const SIDEBAR_KEY = "planimetry-sidebar";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { projects, addProject, deleteProject, updateProject, renameProject } = useProjects();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored !== null) return stored === "collapsed";
    } catch {}
    return true;
  });

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "open");
    } catch {}
  };

  // Extract active project ID from URL
  const match = pathname.match(/^\/project\/([^/]+)/);
  const activeId = match?.[1] ?? null;

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
