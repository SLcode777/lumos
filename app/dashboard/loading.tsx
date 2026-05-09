import { AppHeader } from "@/components/app-header"

export default function DashboardLoading() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Header is server-rendered without user data — keeps layout stable */}
      <header className="flex items-center justify-between border-b border-border p-4">
        <span className="font-serif text-xl tracking-tight">Lumos</span>
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      </header>
      <main className="container mx-auto w-full max-w-6xl flex-1 space-y-10 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded bg-muted" />
        </div>

        <SectionSkeleton />
        <SectionSkeleton />
      </main>
    </div>
  )
}

function SectionSkeleton() {
  return (
    <section className="space-y-4">
      <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted/50" />
        ))}
      </div>
    </section>
  )
}
