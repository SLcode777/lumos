import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AlertTriangle, ArrowLeft } from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AccessError } from "@/lib/access"
import { decrypt } from "@/lib/crypto"
import { getSession } from "@/lib/get-session"
import { introspectSchema, type DatabaseSchema } from "@/lib/introspect"
import { loadConnection } from "@/lib/load-connection"
import { getConnectionPool } from "@/lib/pool-manager"

import { Sidebar } from "./sidebar"

export default async function ConnectionLayout({
  children,
  params,
}: LayoutProps<"/dashboard/connections/[id]">) {
  const session = await getSession()
  const { id } = await params

  if (!session) {
    redirect(`/signin?next=/dashboard/connections/${id}`)
  }

  let conn
  try {
    conn = await loadConnection(id, session.user.id)
  } catch (err) {
    if (err instanceof AccessError) notFound()
    throw err
  }

  // Decrypt server-side and warm the pool. The decrypted string never leaves
  // this function frame except inside `pg.Pool`'s internal config, which is
  // also server-side only.
  const connectionString = decrypt({
    ciphertext: conn.encryptedConnString,
    iv: conn.iv,
    authTag: conn.authTag,
  })

  const pool = getConnectionPool(conn.id, connectionString, conn.sslEnabled)

  // Run introspection here so we can render an in-place fallback if it fails
  // (DB unreachable, auth denied, timeout). same-segment error.tsx doesn't
  // catch errors thrown from the layout itself or its imported components,
  // so we have to handle this inline. Keeping the header visible gives the
  // user a back link + connection context while the sidebar shows the error.
  let schema: DatabaseSchema | null = null
  try {
    schema = await introspectSchema(pool)
  } catch (err) {
    console.error("[connection-detail] introspection failed:", err instanceof Error ? err.message : err)
  }

  // Re-extract the host for the header (UI-friendly, no decrypted secret).
  let host = "—"
  try {
    host = new URL(connectionString).hostname || "—"
  } catch {
    // Already logged at decrypt time if it ever throws — keep the page stable.
  }

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader user={session.user} />
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-serif text-2xl tracking-tight">{conn.name}</h1>
              <p className="font-mono text-xs text-muted-foreground">{host}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {conn.role === "viewer" ? <Badge variant="outline">shared with me</Badge> : null}
            {conn.sslEnabled ? <Badge variant="secondary">SSL</Badge> : null}
            {conn.isReadOnly ? <Badge variant="secondary">Read-only</Badge> : null}
          </div>
        </header>

        <div className="flex flex-1">
          {schema ? (
            <Sidebar schema={schema} connectionId={conn.id} />
          ) : (
            <SidebarErrorFallback />
          )}

          {/* Main content slot */}
          <section className="flex-1">{children}</section>
        </div>
      </main>
    </div>
  )
}

function SidebarErrorFallback() {
  return (
    <aside className="flex w-64 shrink-0 flex-col items-center justify-center border-r border-border bg-muted/30 p-4 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="mt-3 text-sm font-medium">Couldn&apos;t load tables</p>
      <p className="mt-1 text-xs text-muted-foreground">
        The database is unreachable or rejected the connection. Check the credentials and try again.
      </p>
    </aside>
  )
}
