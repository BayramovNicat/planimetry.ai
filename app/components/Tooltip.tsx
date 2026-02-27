"use client";

import type { ReactNode } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ label, children, side = "bottom" }: TooltipProps) {
  const positions: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <div className="relative group/tip">
      {children}
      <div
        className={`absolute ${positions[side]} pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap px-2 py-1 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium`}
      >
        {label}
      </div>
    </div>
  );
}
