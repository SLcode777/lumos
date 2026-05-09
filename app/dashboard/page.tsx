import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { Button } from "@/components/ui/button"
import { listConnectionsForUser } from "@/lib/connections"
import { getSession } from "@/lib/get-session"

import { ConnectionsList } from "./connections-list"

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/signin?next=/dashboard")
  }

  const { owned, shared } = await listConnectionsForUser(session.user.id)

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader user={session.user} />
      <main className="container mx-auto w-full max-w-6xl flex-1 space-y-10 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl tracking-tight">Connections</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse the PostgreSQL databases you own or have access to.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/new">
              <Plus className="h-4 w-4" /> New connection
            </Link>
          </Button>
        </header>

        <ConnectionsList title="My connections" connections={owned} variant="owned" />
        <ConnectionsList title="Shared with me" connections={shared} variant="shared" />
      </main>
    </div>
  )
}
