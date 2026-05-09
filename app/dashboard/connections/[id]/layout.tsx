import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AccessError } from "@/lib/access"
import { decrypt } from "@/lib/crypto"
import { getSession } from "@/lib/get-session"
import { loadConnection } from "@/lib/load-connection"
import { getConnectionPool } from "@/lib/pool-manager"

export default async function ConnectionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
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
  // Warming is cheap: pg.Pool doesn't connect at construction. The first
  // `pool.query(...)` in #23 will trigger the actual TCP handshake.
  getConnectionPool(conn.id, connectionString, conn.sslEnabled)

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
          {/* Sidebar slot — placeholder for #21, replaced in #23 */}
          <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Tables list comes in #23.</p>
          </aside>

          {/* Main content slot */}
          <section className="flex-1">{children}</section>
        </div>
      </main>
    </div>
  )
}
