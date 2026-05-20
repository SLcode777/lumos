import { notFound, redirect } from "next/navigation"

import { AccessError } from "@/lib/access"
import { getSession } from "@/lib/get-session"
import { loadConnection } from "@/lib/load-connection"

export default async function ConnectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await params

  if (!session) {
    redirect(`/signin?next=/dashboard/connections/${id}`)
  }

  // Same call as in the layout — `loadConnection` (React.cache) makes this
  // a no-op DB-wise: only one query runs per request.
  try {
    await loadConnection(id, session.user.id)
  } catch (err) {
    if (err instanceof AccessError) notFound()
    throw err
  }

  return (
    <div className="flex h-full items-center justify-center p-12 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-medium">No table selected</h2>
        <p className="text-sm text-muted-foreground">
          Pick a table from the sidebar to start browsing. Table browsing ships in Phase 4.
        </p>
      </div>
    </div>
  )
}
