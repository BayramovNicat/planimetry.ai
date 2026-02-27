"use client";

import { useEffect, useState } from "react";

const TIPS = [
  "Detecting boundaries",
  "Measuring dimensions",
  "Classifying rooms",
  "Computing areas",
  "Generating layout",
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
      <div className="relative h-24 w-24">
        <div className="loading-room absolute inset-0 rounded-2xl border-2 border-blue-400/60" />
        <div className="loading-room-delay-1 absolute top-2 left-2 h-10 w-9 rounded-md border-2 border-emerald-400/80" />
        <div className="loading-room-delay-2 absolute top-2 right-2 h-10 w-10 rounded-md border-2 border-amber-400/80" />
        <div className="loading-room-delay-3 absolute right-2 bottom-2 left-2 h-8 rounded-md border-2 border-violet-400/80" />
        {/* Scanning line */}
        <div className="loading-scan absolute inset-x-0 h-0.5 bg-linear-to-r from-transparent via-blue-400 to-transparent" />
      </div>

      {/* Rotating tips */}
      <div className="flex h-6 items-center">
        <p
          key={tipIndex}
          className="loading-dots loading-tip-fade text-[13px] font-medium text-white/70"
        >
          {TIPS[tipIndex]}
        </p>
      </div>
    </div>
  );
}
