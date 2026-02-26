"use client";

import { useState, useEffect } from "react";

const TIPS = [
  "Detecting walls and boundaries",
  "Measuring room dimensions",
  "Identifying room types",
  "Calculating areas",
  "Mapping the layout",
];

export function LoadingSkeleton() {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Animated floor plan icon */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-2xl border-2 border-blue-400/60 loading-room" />
        <div className="absolute top-2 left-2 w-9 h-10 rounded-md border-2 border-emerald-400/80 loading-room-delay-1" />
        <div className="absolute top-2 right-2 w-10 h-10 rounded-md border-2 border-amber-400/80 loading-room-delay-2" />
        <div className="absolute bottom-2 left-2 right-2 h-8 rounded-md border-2 border-violet-400/80 loading-room-delay-3" />
        {/* Scanning line */}
        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent loading-scan" />
      </div>

      {/* Rotating tips */}
      <div className="h-6 flex items-center">
        <p
          key={tipIndex}
          className="text-sm font-medium text-white/80 loading-dots loading-tip-fade"
        >
          {TIPS[tipIndex]}
        </p>
      </div>
    </div>
  );
}
