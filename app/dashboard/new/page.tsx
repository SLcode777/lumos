import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/get-session"

import { ConnectionForm } from "./connection-form"

export default async function NewConnectionPage() {
  const session = await getSession()

  if (!session) {
    redirect("/signin?next=/dashboard/new")
  }

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader user={session.user} />
      <main className="container mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>

        <header>
          <h1 className="font-serif text-3xl tracking-tight">New connection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a PostgreSQL database to browse from Lumos. Credentials are encrypted at rest with AES-256-GCM.
          </p>
        </header>

        <ConnectionForm />
      </main>
    </div>
  )
}
