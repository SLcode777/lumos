export default function ConnectionDetailLoading() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Fake header */}
      <header className="flex items-center justify-between border-b border-border p-4">
        <div className="h-6 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      </header>
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex flex-1">
          <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-4">
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </aside>
          <section className="flex flex-1 items-center justify-center">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          </section>
        </div>
      </main>
    </div>
  )
}
