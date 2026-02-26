export function LoadingSkeleton() {
  return (
    <div>
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4 loading-dots">
        Analyzing floor plan
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800 h-28"
          />
        ))}
      </div>
    </div>
  );
}
