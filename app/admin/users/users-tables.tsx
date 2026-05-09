"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import type { UserListItem } from "@/lib/users"

import { deleteUserAction, setUserDisabledAction, setUserRoleAction } from "./actions"
import { DeleteUserDialog } from "./delete-user-dialog"

type Props = {
  users: UserListItem[]
  currentUserId: string
  page: number
  totalPages: number
  totalCount: number
}

export function UsersTable({ users, currentUserId, page, totalPages, totalCount }: Props) {
  const [pending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState<UserListItem | null>(null)

  function runAction(formData: FormData, action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action(formData)
      if (!result.ok && result.error) {
        toast.error(result.error)
      }
    })
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No users yet.</div>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId
            const isDisabled = u.disabledAt !== null
            const isAdmin = u.role === "admin"

            return (
              <TableRow key={u.id} className={isDisabled ? "opacity-60" : ""}>
                <TableCell className="font-medium">
                  {u.email}
                  {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                </TableCell>
                <TableCell>{u.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={isAdmin ? "default" : "secondary"}>{u.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={isDisabled ? "outline" : "default"}>{isDisabled ? "disabled" : "active"}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.createdAt.toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {/* Promote / Demote */}
                    <form
                      action={(fd) => {
                        fd.set("id", u.id)
                        fd.set("role", isAdmin ? "user" : "admin")
                        runAction(fd, setUserRoleAction)
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                        {isAdmin ? "Demote" : "Promote"}
                      </Button>
                    </form>

                    {/* Disable / Enable */}
                    <form
                      action={(fd) => {
                        fd.set("id", u.id)
                        fd.set("disabled", isDisabled ? "false" : "true")
                        runAction(fd, setUserDisabledAction)
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm" disabled={pending || isSelf}>
                        {isDisabled ? "Enable" : "Disable"}
                      </Button>
                    </form>

                    {/* Delete */}
                    <Button variant="destructive" size="sm" disabled={pending || isSelf} onClick={() => setDeleting(u)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {totalCount} user{totalCount > 1 ? "s" : ""} total.
        </p>
      )}

      <DeleteUserDialog
        user={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={(id) => {
          const fd = new FormData()
          fd.set("id", id)
          runAction(fd, deleteUserAction)
          setDeleting(null)
        }}
      />
    </div>
  )
}

function Pagination({ page, totalPages, totalCount }: { page: number; totalPages: number; totalCount: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        Page {page} of {totalPages} — {totalCount} users
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} asChild>
          <Link href={`/admin/users?page=${page - 1}`}>Previous</Link>
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} asChild>
          <Link href={`/admin/users?page=${page + 1}`}>Next</Link>
        </Button>
      </div>
    </div>
  )
}
