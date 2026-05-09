"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { revokeInvitationAction } from "./actions"
import type { InvitationListItem } from "@/lib/invitations"

export function InvitationsTable({ invitations }: { invitations: InvitationListItem[] }) {
  if (invitations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No invitations yet.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((inv) => (
          <TableRow key={inv.id}>
            <TableCell className="font-medium">{inv.email ?? "—"}</TableCell>
            <TableCell>{inv.createdAt.toLocaleDateString()}</TableCell>
            <TableCell>{inv.expiresAt.toLocaleDateString()}</TableCell>
            <TableCell>
              <StatusBadge status={inv.status} />
            </TableCell>
            <TableCell className="text-right">
              {inv.status === "pending" ? (
                <form
                  action={async (formData) => {
                    await revokeInvitationAction(formData)
                  }}
                >
                  <input type="hidden" name="id" value={inv.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    Revoke
                  </Button>
                </form>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function StatusBadge({ status }: { status: InvitationListItem["status"] }) {
  const variant = status === "pending" ? "default" : status === "consumed" ? "secondary" : "outline"
  return <Badge variant={variant}>{status}</Badge>
}
