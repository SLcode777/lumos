import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { Button } from "@/components/ui/button"
import { AccessError } from "@/lib/access"
import { decrypt } from "@/lib/crypto"
import { getSession } from "@/lib/get-session"
import { loadConnection } from "@/lib/load-connection"

import { SettingsClient } from "./settings-client"

/**
 * WHATWG URL exposes username/password percent-encoded. Decode for display
 * so the user sees what she originally typed. Falls back to the raw value
 * if the string is malformed (rare — only if the saved URL contains an
 * invalid % sequence, which our own builder never produces).
 */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export default async function ConnectionSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  const { id } = await params

  if (!session) {
    redirect(`/signin?next=/dashboard/connections/${id}/settings`)
  }

  let conn
  try {
    conn = await loadConnection(id, session.user.id)
  } catch (err) {
    if (err instanceof AccessError) notFound()
    throw err
  }

  // Owner-only gate at the page level. Viewers reaching this URL get a 404,
  // not a 403 — same anti-enumeration logic as the actions.
  if (conn.role !== "owner") {
    notFound()
  }

  // Decrypt server-side and parse into components for the Fields tab. The
  // decrypted blob is sent to the client as form initial values — same threat
  // model as Neon / Supabase / RDS consoles: the authenticated owner is
  // entitled to see what she configured. The DB row stays encrypted at rest;
  // ENCRYPTION_KEY is still the only way to bulk-recover credentials from a
  // stolen lumos.db.
  const connectionString = decrypt({
    ciphertext: conn.encryptedConnString,
    iv: conn.iv,
    authTag: conn.authTag,
  })
  const url = new URL(connectionString)

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
          <h1 className="font-serif text-3xl tracking-tight">{conn.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit this connection&apos;s name, credentials, or flags. Changes apply immediately.
          </p>
        </header>

        <SettingsClient
          connectionId={conn.id}
          initialValues={{
            name: conn.name,
            sslEnabled: conn.sslEnabled,
            isReadOnly: conn.isReadOnly,
            connectionString,
            host: url.hostname,
            port: url.port ? Number(url.port) : 5432,
            database: url.pathname.replace(/^\//, ""),
            user: safeDecode(url.username),
            password: safeDecode(url.password),
          }}
        />
      </main>
    </div>
  )
}
