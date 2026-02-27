"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ellipsis, Pencil, Trash2, Plus, Menu, Search, X } from "lucide-react";
import { Tooltip } from "./Tooltip";
import type { Project } from "../types";

interface SidebarProps {
  projects: Project[];
  activeId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onDelete: (id: string) => string | null;
  onRename: (id: string, name: string) => void;
}

export function Sidebar({
  projects,
  activeId,
  collapsed,
  onToggle,
  onDelete,
  onRename,
}: SidebarProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenId]);

  const startRename = useCallback((id: string, currentName: string) => {
    setMenuOpenId(null);
    setEditingId(id);
    setEditValue(currentName);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onRename]);

  const handleDelete = useCallback(
    (id: string) => {
      setMenuOpenId(null);
      const nextId = onDelete(id);
      if (nextId) {
        router.push(`/project/${nextId}`);
      } else {
        router.push("/");
      }
    },
    [onDelete, router],
  );

  return (
    <>
      {/* Toggle button + new plan shortcut — always visible */}
      <div className="fixed top-3 left-3 z-50 flex flex-col items-center gap-1">
        <Tooltip label={collapsed ? "Open sidebar" : "Close sidebar"} side="right">
          <button
            onClick={onToggle}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-300 cursor-pointer"
          >
            <Menu size={20} className="text-zinc-600 dark:text-zinc-400" />
          </button>
        </Tooltip>
        {collapsed && (
          <Tooltip label="New plan" side="right">
            <Link
              href="/"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-300 cursor-pointer"
            >
              <Plus size={20} className="text-zinc-600 dark:text-zinc-400" />
            </Link>
          </Tooltip>
        )}
      </div>

      {/* Backdrop for mobile when open */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-zinc-50 dark:bg-zinc-950 z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        {/* Header area */}
        <div className="px-3 pt-3 pb-2">
          {/* Toggle spacer + search button row */}
          <div className="flex items-center justify-between">
            <div className="w-10 h-10" />
            <Tooltip label={searching ? "Close search" : "Search"} side="bottom">
              <button
                onClick={() => {
                  setSearching(!searching);
                  setSearchQuery("");
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {searching ? (
                  <X size={16} className="text-zinc-600 dark:text-zinc-400" />
                ) : (
                  <Search size={16} className="text-zinc-600 dark:text-zinc-400" />
                )}
              </button>
            </Tooltip>
          </div>

          {/* Search input */}
          {searching && (
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearching(false);
                  setSearchQuery("");
                }
              }}
              placeholder="Search plans..."
              autoFocus
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-blue-500 transition-colors"
            />
          )}

          {/* New plan button */}
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 mt-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            New plan
          </Link>
        </div>

        {/* Project list */}
        <nav className="flex-1 overflow-y-auto px-2 py-1">
          {projects.length === 0 && (
            <p className="px-3 py-6 text-xs text-zinc-400 dark:text-zinc-500 text-center">
              Upload a floor plan to get started
            </p>
          )}

          {projects.filter((p) =>
            !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
          ).map((project) => {
            const isActive = project.id === activeId;
            const isEditing = editingId === project.id;
            const isMenuOpen = menuOpenId === project.id;

            return (
              <div
                key={project.id}
                className={`group relative flex items-center rounded-lg text-[13px] transition-colors ${
                  isActive
                    ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                }`}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 bg-white dark:bg-zinc-700 px-3 py-2 rounded-lg text-sm outline-none border border-blue-400"
                  />
                ) : (
                  <>
                    <Link
                      href={`/project/${project.id}`}
                      className="flex-1 px-3 py-2 truncate"
                    >
                      {project.name}
                    </Link>

                    {/* 3-dot menu trigger */}
                    <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(isMenuOpen ? null : project.id);
                        }}
                        className={`mr-1.5 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-300/50 dark:hover:bg-zinc-700/50 transition-all cursor-pointer ${
                          isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <Ellipsis size={16} />
                      </button>

                      {/* Dropdown */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 py-1 z-50">
                          <button
                            onClick={() => startRename(project.id, project.name)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            <Pencil size={14} />
                            Rename
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
