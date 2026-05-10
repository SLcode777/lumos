export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="h-9 max-w-md flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Cards skeleton */}
      <div className="flex-1 space-y-3 overflow-hidden p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5">
            <div className="mb-3 h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="h-14 animate-pulse rounded-md bg-muted/60" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
