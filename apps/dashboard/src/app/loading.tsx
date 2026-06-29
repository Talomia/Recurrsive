export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen animate-fade-in-up">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-4 w-72 mt-2" />
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Top metrics row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 min-h-[160px]">
              <div className="flex items-center gap-2 mb-4">
                <div className="skeleton h-8 w-8 rounded-lg" />
                <div className="skeleton h-4 w-24" />
              </div>
              <div className="skeleton h-9 w-20 mb-3" />
              <div className="skeleton h-8 w-full" />
            </div>
          ))}
        </div>

        {/* Chart + opportunities row */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 glass-card p-6">
            <div className="skeleton h-6 w-40 mb-4" />
            <div className="skeleton h-[260px] w-full rounded-xl" />
          </div>
          <div className="xl:col-span-2 glass-card p-6">
            <div className="skeleton h-6 w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 w-full" />
              ))}
            </div>
          </div>
        </div>

        {/* Performance metrics */}
        <div>
          <div className="skeleton h-5 w-40 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-5 min-h-[140px]">
                <div className="skeleton h-4 w-24 mb-3" />
                <div className="skeleton h-8 w-20 mb-2" />
                <div className="skeleton h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
