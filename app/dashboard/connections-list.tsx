import Link from "next/link"
import { Lock, Eye, ShieldCheck, Share2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import type { ConnectionListItem } from "@/lib/connections"

type Props = {
  title: string
  connections: ConnectionListItem[]
  variant: "owned" | "shared"
}

export function ConnectionsList({ title, connections, variant }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {connections.length} {connections.length === 1 ? "connection" : "connections"}
        </span>
      </div>

      {connections.length === 0 ? (
        <EmptyState variant={variant} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connections.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/connections/${c.id}`}
                className="block rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ConnectionCard connection={c} showSharedBy={variant === "shared"} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ConnectionCard({ connection, showSharedBy }: { connection: ConnectionListItem; showSharedBy: boolean }) {
  const { name, host, sslEnabled, isReadOnly, sharedBy } = connection

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="truncate">{name}</CardTitle>
        <p className="truncate font-mono text-xs text-muted-foreground">{host}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {sslEnabled ? (
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3 w-3" /> SSL
          </Badge>
        ) : null}
        {isReadOnly ? (
          <Badge variant="secondary" className="gap-1">
            <Eye className="h-3 w-3" /> Read-only
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Lock className="h-3 w-3" /> Read-write
          </Badge>
        )}
        {showSharedBy && sharedBy ? (
          <Badge variant="outline" className="gap-1">
            <Share2 className="h-3 w-3" /> shared by {sharedBy.name ?? sharedBy.email}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  )
}

function EmptyState({ variant }: { variant: "owned" | "shared" }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {variant === "owned"
        ? 'You haven\'t added any connection yet. Click "New connection" to get started.'
        : "No connection has been shared with you yet."}
    </div>
  )
}
